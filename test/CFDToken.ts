import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("CFDToken", function () {
  async function deploy() {
    const [admin, minter, alice, bob] = await ethers.getSigners();
    const token = await ethers.deployContract("CFDToken", [admin.address]);
    const MINTER_ROLE = await token.MINTER_ROLE();
    await token.connect(admin).grantRole(MINTER_ROLE, minter.address);
    return { token, admin, minter, alice, bob, MINTER_ROLE };
  }

  describe("Deploiement", function () {
    it("a le bon nom, symbole et taux", async function () {
      const { token } = await deploy();
      expect(await token.name()).to.equal("Crowdfunding DAO Token");
      expect(await token.symbol()).to.equal("CFD");
      expect(await token.RATE()).to.equal(1000n);
      expect(await token.totalSupply()).to.equal(0n);
    });

    it("donne le role admin a l'adresse fournie", async function () {
      const { token, admin } = await deploy();
      const ADMIN_ROLE = await token.DEFAULT_ADMIN_ROLE();
      expect(await token.hasRole(ADMIN_ROLE, admin.address)).to.equal(true);
    });

    it("refuse une adresse admin nulle", async function () {
      await expect(
        ethers.deployContract("CFDToken", [ethers.ZeroAddress]),
      ).to.be.revertedWith("CFD: admin is zero address");
    });
  });

  describe("Controle d'acces", function () {
    it("seul l'admin peut donner le MINTER_ROLE", async function () {
      const { token, alice, bob, MINTER_ROLE } = await deploy();
      await expect(
        token.connect(alice).grantRole(MINTER_ROLE, bob.address),
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });

    it("refuse le mint a un compte sans MINTER_ROLE", async function () {
      const { token, alice, MINTER_ROLE } = await deploy();
      await expect(
        token.connect(alice).mintForContribution(alice.address, ethers.parseEther("1")),
      )
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount")
        .withArgs(alice.address, MINTER_ROLE);
    });
  });

  describe("mintForContribution", function () {
    it("1 ETH donne 1000 CFD", async function () {
      const { token, minter, alice } = await deploy();
      await token.connect(minter).mintForContribution(alice.address, ethers.parseEther("1"));
      expect(await token.balanceOf(alice.address)).to.equal(ethers.parseEther("1000"));
      expect(await token.totalSupply()).to.equal(ethers.parseEther("1000"));
    });

    it("emet l'evenement Transfer depuis l'adresse zero", async function () {
      const { token, minter, alice } = await deploy();
      await expect(
        token.connect(minter).mintForContribution(alice.address, ethers.parseEther("0.5")),
      )
        .to.emit(token, "Transfer")
        .withArgs(ethers.ZeroAddress, alice.address, ethers.parseEther("500"));
    });

    it("respecte le taux pour plusieurs montants", async function () {
      const { token, minter, alice } = await deploy();
      const montants = ["0.001", "0.1", "2", "37.5"];
      let attendu = 0n;
      for (const m of montants) {
        const wei = ethers.parseEther(m);
        await token.connect(minter).mintForContribution(alice.address, wei);
        attendu += wei * 1000n;
        expect(await token.balanceOf(alice.address)).to.equal(attendu);
      }
    });
  });

  describe("Gouvernance (ERC20Votes)", function () {
    it("delegue automatiquement le pouvoir de vote a soi-meme", async function () {
      const { token, minter, alice } = await deploy();
      await token.connect(minter).mintForContribution(alice.address, ethers.parseEther("1"));
      expect(await token.delegates(alice.address)).to.equal(alice.address);
      expect(await token.getVotes(alice.address)).to.equal(ethers.parseEther("1000"));
    });

    it("ne remplace pas une delegation deja choisie", async function () {
      const { token, minter, alice, bob } = await deploy();
      await token.connect(minter).mintForContribution(alice.address, ethers.parseEther("1"));
      await token.connect(alice).delegate(bob.address);
      await token.connect(minter).mintForContribution(alice.address, ethers.parseEther("1"));
      expect(await token.delegates(alice.address)).to.equal(bob.address);
      expect(await token.getVotes(bob.address)).to.equal(ethers.parseEther("2000"));
    });

    it("getPastVotes garde la valeur du snapshot (anti prise de controle eclair)", async function () {
      const { token, minter, alice } = await deploy();
      await token.connect(minter).mintForContribution(alice.address, ethers.parseEther("1"));
      const snapshot = await ethers.provider.getBlockNumber();

      await token.connect(minter).mintForContribution(alice.address, ethers.parseEther("9"));
      await ethers.provider.send("evm_mine", []);

      expect(await token.getPastVotes(alice.address, snapshot)).to.equal(ethers.parseEther("1000"));
      expect(await token.getVotes(alice.address)).to.equal(ethers.parseEther("10000"));
    });

    it("getPastTotalSupply garde la valeur du snapshot", async function () {
      const { token, minter, alice } = await deploy();
      await token.connect(minter).mintForContribution(alice.address, ethers.parseEther("1"));
      const snapshot = await ethers.provider.getBlockNumber();

      await token.connect(minter).mintForContribution(alice.address, ethers.parseEther("1"));
      await ethers.provider.send("evm_mine", []);

      expect(await token.getPastTotalSupply(snapshot)).to.equal(ethers.parseEther("1000"));
      expect(await token.totalSupply()).to.equal(ethers.parseEther("2000"));
    });

    it("un transfert deplace le pouvoir de vote seulement si le destinataire a delegue", async function () {
      const { token, minter, alice, bob } = await deploy();
      await token.connect(minter).mintForContribution(alice.address, ethers.parseEther("1"));

      await token.connect(alice).transfer(bob.address, ethers.parseEther("400"));
      expect(await token.getVotes(alice.address)).to.equal(ethers.parseEther("600"));
      expect(await token.getVotes(bob.address)).to.equal(0n);

      await token.connect(bob).delegate(bob.address);
      expect(await token.getVotes(bob.address)).to.equal(ethers.parseEther("400"));
    });
  });

  describe("Permit", function () {
    it("les nonces demarrent a zero", async function () {
      const { token, alice } = await deploy();
      expect(await token.nonces(alice.address)).to.equal(0n);
    });
  });
});