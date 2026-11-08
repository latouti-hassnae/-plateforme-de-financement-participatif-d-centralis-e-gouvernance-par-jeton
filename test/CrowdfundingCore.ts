import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

const Status = { Active: 0n, Successful: 1n, Failed: 2n, Cancelled: 3n };
const JOUR = 24 * 60 * 60;

async function avancer(secondes: number) {
  await ethers.provider.send("evm_increaseTime", [secondes]);
  await ethers.provider.send("evm_mine", []);
}

describe("CrowdfundingCore", function () {
  async function deploy() {
    const [admin, o1, o2, o3, governance, creator, alice, bob, intrus] =
      await ethers.getSigners();

    const treasury = await ethers.deployContract("MultiSigTreasury", [
      [o1.address, o2.address, o3.address],
      ethers.parseEther("1"),
    ]);
    const token = await ethers.deployContract("CFDToken", [admin.address]);
    const core = await ethers.deployContract("CrowdfundingCore", [
      await token.getAddress(),
      await treasury.getAddress(),
      admin.address,
    ]);

    await token.connect(admin).grantRole(await token.MINTER_ROLE(), await core.getAddress());
    await core.connect(admin).grantRole(await core.GOVERNANCE_ROLE(), governance.address);

    return { core, token, treasury, admin, governance, creator, alice, bob, intrus };
  }

  // Campagne de 5 ETH sur 30 jours, creee par "creator" (id = 1)
  async function avecCampagne() {
    const ctx = await deploy();
    await ctx.core.connect(ctx.creator).createCampaign(ethers.parseEther("5"), 30 * JOUR, "QmTestHash");
    return ctx;
  }

  describe("createCampaign", function () {
    it("cree une campagne avec les bonnes donnees", async function () {
      const { core, creator } = await avecCampagne();
      const c = await core.getCampaign(1);
      expect(await core.campaignCount()).to.equal(1n);
      expect(c.beneficiary).to.equal(creator.address);
      expect(c.goal).to.equal(ethers.parseEther("5"));
      expect(c.raised).to.equal(0n);
      expect(c.ipfsHash).to.equal("QmTestHash");
      expect(await core.getStatus(1)).to.equal(Status.Active);
    });

    it("emet CampaignCreated", async function () {
      const { core, creator } = await deploy();
      await expect(core.connect(creator).createCampaign(ethers.parseEther("1"), JOUR, "QmX"))
        .to.emit(core, "CampaignCreated");
    });

    it("refuse un objectif nul, une duree nulle et un hash vide", async function () {
      const { core, creator } = await deploy();
      await expect(core.connect(creator).createCampaign(0, JOUR, "QmX")).to.be.revertedWith("Objectif nul");
      await expect(core.connect(creator).createCampaign(1, 0, "QmX")).to.be.revertedWith("Duree nulle");
      await expect(core.connect(creator).createCampaign(1, JOUR, "")).to.be.revertedWith("Hash IPFS vide");
    });
  });

  describe("contribute", function () {
    it("enregistre la contribution et mint 1000 CFD par ETH", async function () {
      const { core, token, alice } = await avecCampagne();
      await expect(core.connect(alice).contribute(1, { value: ethers.parseEther("2") }))
        .to.emit(core, "Contributed")
        .withArgs(1n, alice.address, ethers.parseEther("2"));

      expect((await core.getCampaign(1)).raised).to.equal(ethers.parseEther("2"));
      expect(await core.contributions(1, alice.address)).to.equal(ethers.parseEther("2"));
      expect(await token.balanceOf(alice.address)).to.equal(ethers.parseEther("2000"));
      expect(await token.getVotes(alice.address)).to.equal(ethers.parseEther("2000"));
    });

    it("refuse un montant nul, une campagne inexistante et une campagne terminee", async function () {
      const { core, alice } = await avecCampagne();
      await expect(core.connect(alice).contribute(1, { value: 0 })).to.be.revertedWith("Montant nul");
      await expect(core.connect(alice).contribute(99, { value: 1 })).to.be.revertedWith("Campagne inexistante");
      await avancer(31 * JOUR);
      await expect(core.connect(alice).contribute(1, { value: 1 })).to.be.revertedWith("Campagne terminee");
    });
  });

  describe("getStatus", function () {
    it("passe a Successful quand l'objectif est atteint", async function () {
      const { core, alice } = await avecCampagne();
      await core.connect(alice).contribute(1, { value: ethers.parseEther("5") });
      expect(await core.getStatus(1)).to.equal(Status.Successful);
    });

    it("passe a Failed apres l'echeance si l'objectif n'est pas atteint", async function () {
      const { core, alice } = await avecCampagne();
      await core.connect(alice).contribute(1, { value: ethers.parseEther("1") });
      await avancer(31 * JOUR);
      expect(await core.getStatus(1)).to.equal(Status.Failed);
    });

    it("passe a Cancelled apres un gel", async function () {
      const { core, governance } = await avecCampagne();
      await core.connect(governance).freezeCampaign(1);
      expect(await core.getStatus(1)).to.equal(Status.Cancelled);
    });
  });

  describe("refund", function () {
    it("rembourse un contributeur quand la campagne a echoue", async function () {
      const { core, alice } = await avecCampagne();
      await core.connect(alice).contribute(1, { value: ethers.parseEther("1") });
      await avancer(31 * JOUR);

      await expect(core.connect(alice).refund(1))
        .to.emit(core, "Refunded")
        .withArgs(1n, alice.address, ethers.parseEther("1"));

      expect(await core.contributions(1, alice.address)).to.equal(0n);
      expect(await ethers.provider.getBalance(await core.getAddress())).to.equal(0n);
    });

    it("rembourse apres un gel par la gouvernance", async function () {
      const { core, governance, alice } = await avecCampagne();
      await core.connect(alice).contribute(1, { value: ethers.parseEther("5") });
      await core.connect(governance).freezeCampaign(1);
      await core.connect(alice).refund(1);
      expect(await ethers.provider.getBalance(await core.getAddress())).to.equal(0n);
    });

    it("refuse sur une campagne active, sans contribution, ou deux fois", async function () {
      const { core, alice, bob } = await avecCampagne();
      await core.connect(alice).contribute(1, { value: ethers.parseEther("1") });
      await expect(core.connect(alice).refund(1)).to.be.revertedWith("Remboursement impossible");

      await avancer(31 * JOUR);
      await expect(core.connect(bob).refund(1)).to.be.revertedWith("Rien a rembourser");

      await core.connect(alice).refund(1);
      await expect(core.connect(alice).refund(1)).to.be.revertedWith("Rien a rembourser");
    });

    it("le contributeur garde ses CFD apres un refund (limite connue)", async function () {
      const { core, token, alice } = await avecCampagne();
      await core.connect(alice).contribute(1, { value: ethers.parseEther("1") });
      await avancer(31 * JOUR);
      await core.connect(alice).refund(1);
      expect(await token.balanceOf(alice.address)).to.equal(ethers.parseEther("1000"));
    });
  });

  describe("withdrawFunds", function () {
    it("verse 98 % au beneficiaire et 2 % a la tresorerie apres l'echeance", async function () {
      const { core, treasury, creator, alice } = await avecCampagne();
      await core.connect(alice).contribute(1, { value: ethers.parseEther("5") });
      await avancer(31 * JOUR);

      const avant = await ethers.provider.getBalance(creator.address);
      const tx = await core.connect(creator).withdrawFunds(1);
      const receipt = await tx.wait();
      const apres = await ethers.provider.getBalance(creator.address);

      const frais = ethers.parseEther("0.1");
      const versement = ethers.parseEther("4.9");
      expect(await ethers.provider.getBalance(await treasury.getAddress())).to.equal(frais);
      expect(apres - avant + receipt!.fee).to.equal(versement);
      expect(await ethers.provider.getBalance(await core.getAddress())).to.equal(0n);
    });

    it("refuse un compte qui n'est pas le beneficiaire", async function () {
      const { core, alice } = await avecCampagne();
      await core.connect(alice).contribute(1, { value: ethers.parseEther("5") });
      await avancer(31 * JOUR);
      await expect(core.connect(alice).withdrawFunds(1)).to.be.revertedWith("Beneficiaire uniquement");
    });

    it("refuse si l'objectif n'est pas atteint", async function () {
      const { core, creator, alice } = await avecCampagne();
      await core.connect(alice).contribute(1, { value: ethers.parseEther("1") });
      await avancer(31 * JOUR);
      await expect(core.connect(creator).withdrawFunds(1)).to.be.revertedWith("Objectif non atteint");
    });

    it("refuse avant l'echeance sans deblocage anticipe", async function () {
      const { core, creator, alice } = await avecCampagne();
      await core.connect(alice).contribute(1, { value: ethers.parseEther("5") });
      await expect(core.connect(creator).withdrawFunds(1)).to.be.revertedWith("Echeance non atteinte");
    });

    it("autorise avant l'echeance apres un deblocage anticipe de la gouvernance", async function () {
      const { core, governance, creator, alice } = await avecCampagne();
      await core.connect(alice).contribute(1, { value: ethers.parseEther("5") });
      await expect(core.connect(governance).approveEarlyRelease(1))
        .to.emit(core, "EarlyReleaseApproved")
        .withArgs(1n);
      await expect(core.connect(creator).withdrawFunds(1)).to.emit(core, "FundsWithdrawn");
    });

    it("refuse un second retrait", async function () {
      const { core, creator, alice } = await avecCampagne();
      await core.connect(alice).contribute(1, { value: ethers.parseEther("5") });
      await avancer(31 * JOUR);
      await core.connect(creator).withdrawFunds(1);
      await expect(core.connect(creator).withdrawFunds(1)).to.be.revertedWith("Fonds deja retires");
    });
  });

  describe("Gouvernance", function () {
    it("seul GOVERNANCE_ROLE peut debloquer ou geler", async function () {
      const { core, intrus } = await avecCampagne();
      await expect(core.connect(intrus).approveEarlyRelease(1))
        .to.be.revertedWithCustomError(core, "AccessControlUnauthorizedAccount");
      await expect(core.connect(intrus).freezeCampaign(1))
        .to.be.revertedWithCustomError(core, "AccessControlUnauthorizedAccount");
    });

    it("refuse de geler une campagne deja retiree", async function () {
      const { core, governance, creator, alice } = await avecCampagne();
      await core.connect(alice).contribute(1, { value: ethers.parseEther("5") });
      await avancer(31 * JOUR);
      await core.connect(creator).withdrawFunds(1);
      await expect(core.connect(governance).freezeCampaign(1)).to.be.revertedWith("Fonds deja retires");
    });

    it("refuse les contributions sur une campagne gelee", async function () {
      const { core, governance, alice } = await avecCampagne();
      await core.connect(governance).freezeCampaign(1);
      await expect(core.connect(alice).contribute(1, { value: 1 })).to.be.revertedWith("Campagne gelee");
    });
  });

  describe("Circuit breaker (Pausable)", function () {
    it("bloque contribute et createCampaign en pause, puis les rouvre", async function () {
      const { core, admin, creator, alice } = await avecCampagne();
      await core.connect(admin).pause();
      await expect(core.connect(alice).contribute(1, { value: 1 }))
        .to.be.revertedWithCustomError(core, "EnforcedPause");
      await expect(core.connect(creator).createCampaign(1, JOUR, "QmX"))
        .to.be.revertedWithCustomError(core, "EnforcedPause");

      await core.connect(admin).unpause();
      await expect(core.connect(alice).contribute(1, { value: 1 })).to.emit(core, "Contributed");
    });

    it("seul PAUSER_ROLE peut mettre en pause", async function () {
      const { core, intrus } = await deploy();
      await expect(core.connect(intrus).pause())
        .to.be.revertedWithCustomError(core, "AccessControlUnauthorizedAccount");
    });
  });
});