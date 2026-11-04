import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.connect();

describe("Attaque par reentrance", function () {
  async function deploy() {
    const [admin, treasury, beneficiary, alice, bob] = await ethers.getSigners();

    const token = await ethers.deployContract("CFDToken", [admin.address]);
    const core = await ethers.deployContract("CrowdfundingCore", [
      await token.getAddress(),
      treasury.address,
      admin.address,
    ]);
    await token.grantRole(await token.MINTER_ROLE(), await core.getAddress());

    const attacker = await ethers.deployContract("ReentrancyAttacker", [
      await core.getAddress(),
    ]);
    return { core, attacker, treasury, beneficiary, alice, bob };
  }

  it("refund() : la 2e tentative du pirate est bloquee", async function () {
    const { core, attacker, beneficiary, alice } = await deploy();
    const DAY = 24 * 3600;

    await core.connect(beneficiary).createCampaign(ethers.parseEther("10"), DAY, "QmTest");
    const id = 1n;

    // Alice (honnete) met 5 ETH, le pirate met 1 ETH : objectif de 10 ETH non atteint
    await core.connect(alice).contribute(id, { value: ethers.parseEther("5") });
    await attacker.contribute(id, { value: ethers.parseEther("1") });

    await networkHelpers.time.increase(2 * DAY); // la campagne echoue

    await attacker.attackRefund(id);

    // Le pirate a essaye de rappeler refund() et a ete refuse
    expect(await attacker.reentryBlocked()).to.equal(true);

    // Il a recupere uniquement SON ETH
    const attackerAddr = await attacker.getAddress();
    expect(await ethers.provider.getBalance(attackerAddr)).to.equal(ethers.parseEther("1"));

    // L'argent d'Alice est intact dans le contrat
    expect(await ethers.provider.getBalance(await core.getAddress())).to.equal(ethers.parseEther("5"));

    // Alice peut toujours se faire rembourser (si cela echouait, le test deviendrait rouge)
    await core.connect(alice).refund(id);
    expect(await ethers.provider.getBalance(await core.getAddress())).to.equal(0n);
  });

  it("withdrawFunds() : la 2e tentative du pirate est bloquee", async function () {
    const { core, attacker, treasury, alice, bob } = await deploy();
    const DAY = 24 * 3600;

    // Le pirate est beneficiaire d'une campagne de 5 ETH
    await attacker.createCampaign(ethers.parseEther("5"), DAY, "QmPirate");
    // Une autre campagne contient l'argent de Bob (la "victime")
    await core.connect(alice).createCampaign(ethers.parseEther("10"), DAY, "QmVictime");

    await core.connect(alice).contribute(1n, { value: ethers.parseEther("5") });
    await core.connect(bob).contribute(2n, { value: ethers.parseEther("3") });

    await networkHelpers.time.increase(2 * DAY);

    const treasuryBefore = await ethers.provider.getBalance(treasury.address);
    await attacker.attackWithdraw(1n);

    expect(await attacker.reentryBlocked()).to.equal(true);

    // Il recoit 98 % de 5 ETH = 4.9 ETH, une seule fois
    expect(await ethers.provider.getBalance(await attacker.getAddress())).to.equal(ethers.parseEther("4.9"));
    // La tresorerie recoit 2 % = 0.1 ETH
    expect((await ethers.provider.getBalance(treasury.address)) - treasuryBefore).to.equal(ethers.parseEther("0.1"));
    // Les 3 ETH de Bob sont intacts
    expect(await ethers.provider.getBalance(await core.getAddress())).to.equal(ethers.parseEther("3"));
  });
});