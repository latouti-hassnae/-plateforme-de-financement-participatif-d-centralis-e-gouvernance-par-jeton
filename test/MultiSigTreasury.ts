import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("MultiSigTreasury", function () {
  const LIMITE = ethers.parseEther("1");

  async function deploy() {
    const [admin, o1, o2, o3, intrus, destinataire] = await ethers.getSigners();
    const treasury = await ethers.deployContract("MultiSigTreasury", [
      [o1.address, o2.address, o3.address],
      LIMITE,
    ]);
    // On alimente la tresorerie avec 10 ETH
    await admin.sendTransaction({
      to: await treasury.getAddress(),
      value: ethers.parseEther("10"),
    });
    return { treasury, admin, o1, o2, o3, intrus, destinataire };
  }

  describe("Deploiement", function () {
    it("enregistre les 3 proprietaires et la limite", async function () {
      const { treasury, o1, o2, o3, intrus } = await deploy();
      expect(Array.from(await treasury.getOwners())).to.deep.equal([
        o1.address,
        o2.address,
        o3.address,
      ]);
      expect(await treasury.isOwner(o1.address)).to.equal(true);
      expect(await treasury.isOwner(intrus.address)).to.equal(false);
      expect(await treasury.smallLimit()).to.equal(LIMITE);
      expect(await treasury.REQUIRED_ABOVE_LIMIT()).to.equal(2n);
    });

    it("refuse un nombre de proprietaires different de 3", async function () {
      const [, o1, o2] = await ethers.getSigners();
      await expect(
        ethers.deployContract("MultiSigTreasury", [[o1.address, o2.address], LIMITE]),
      ).to.be.revertedWith("MS: need 3 owners");
    });

    it("refuse une adresse proprietaire nulle", async function () {
      const [, o1, o2] = await ethers.getSigners();
      await expect(
        ethers.deployContract("MultiSigTreasury", [
          [o1.address, o2.address, ethers.ZeroAddress],
          LIMITE,
        ]),
      ).to.be.revertedWith("MS: zero owner");
    });

    it("refuse un proprietaire en double", async function () {
      const [, o1, o2] = await ethers.getSigners();
      await expect(
        ethers.deployContract("MultiSigTreasury", [
          [o1.address, o2.address, o1.address],
          LIMITE,
        ]),
      ).to.be.revertedWith("MS: duplicate owner");
    });
  });

  describe("Depots", function () {
    it("accepte l'ETH et emet Deposit", async function () {
      const { treasury, admin } = await deploy();
      await expect(
        admin.sendTransaction({
          to: await treasury.getAddress(),
          value: ethers.parseEther("2"),
        }),
      )
        .to.emit(treasury, "Deposit")
        .withArgs(admin.address, ethers.parseEther("2"));
      expect(await ethers.provider.getBalance(await treasury.getAddress())).to.equal(
        ethers.parseEther("12"),
      );
    });
  });

  describe("submit", function () {
    it("cree une transaction confirmee d'office par le proposant", async function () {
      const { treasury, o1, destinataire } = await deploy();
      await expect(treasury.connect(o1).submit(destinataire.address, ethers.parseEther("2")))
        .to.emit(treasury, "Submitted")
        .withArgs(0n, o1.address, destinataire.address, ethers.parseEther("2"));

      const t = await treasury.transactions(0);
      expect(await treasury.transactionCount()).to.equal(1n);
      expect(t.to).to.equal(destinataire.address);
      expect(t.value).to.equal(ethers.parseEther("2"));
      expect(t.executed).to.equal(false);
      expect(t.confirmations).to.equal(1n);
      expect(await treasury.confirmed(0, o1.address)).to.equal(true);
    });

    it("refuse un compte qui n'est pas proprietaire", async function () {
      const { treasury, intrus, destinataire } = await deploy();
      await expect(
        treasury.connect(intrus).submit(destinataire.address, 1),
      ).to.be.revertedWith("MS: not owner");
    });

    it("refuse une destination nulle", async function () {
      const { treasury, o1 } = await deploy();
      await expect(
        treasury.connect(o1).submit(ethers.ZeroAddress, 1),
      ).to.be.revertedWith("MS: zero destination");
    });
  });

  describe("execute : montant sous la limite", function () {
    it("1 seule confirmation suffit", async function () {
      const { treasury, o1, destinataire } = await deploy();
      const avant = await ethers.provider.getBalance(destinataire.address);

      await treasury.connect(o1).submit(destinataire.address, ethers.parseEther("0.5"));
      await expect(treasury.connect(o1).execute(0))
        .to.emit(treasury, "Executed")
        .withArgs(0n);

      const apres = await ethers.provider.getBalance(destinataire.address);
      expect(apres - avant).to.equal(ethers.parseEther("0.5"));
    });

    it("un montant egal a la limite compte comme petit", async function () {
      const { treasury, o1, destinataire } = await deploy();
      await treasury.connect(o1).submit(destinataire.address, LIMITE);
      await expect(treasury.connect(o1).execute(0)).to.emit(treasury, "Executed");
    });
  });

  describe("execute : montant au-dessus de la limite (2 sur 3)", function () {
    it("refuse avec une seule confirmation", async function () {
      const { treasury, o1, destinataire } = await deploy();
      await treasury.connect(o1).submit(destinataire.address, ethers.parseEther("2"));
      await expect(treasury.connect(o1).execute(0)).to.be.revertedWith(
        "MS: not enough confirmations",
      );
    });

    it("execute avec 2 confirmations et verse le montant", async function () {
      const { treasury, o1, o2, destinataire } = await deploy();
      const avant = await ethers.provider.getBalance(destinataire.address);

      await treasury.connect(o1).submit(destinataire.address, ethers.parseEther("2"));
      await expect(treasury.connect(o2).confirm(0))
        .to.emit(treasury, "Confirmed")
        .withArgs(0n, o2.address);
      await expect(treasury.connect(o2).execute(0)).to.emit(treasury, "Executed");

      const apres = await ethers.provider.getBalance(destinataire.address);
      expect(apres - avant).to.equal(ethers.parseEther("2"));
      expect(await ethers.provider.getBalance(await treasury.getAddress())).to.equal(
        ethers.parseEther("8"),
      );
    });

    it("echoue si la tresorerie n'a pas assez de fonds", async function () {
      const { treasury, o1, o2, destinataire } = await deploy();
      await treasury.connect(o1).submit(destinataire.address, ethers.parseEther("100"));
      await treasury.connect(o2).confirm(0);
      await expect(treasury.connect(o1).execute(0)).to.be.revertedWith("MS: transfer failed");
    });
  });

  describe("execute : controles generaux", function () {
    it("refuse une seconde execution", async function () {
      const { treasury, o1, destinataire } = await deploy();
      await treasury.connect(o1).submit(destinataire.address, ethers.parseEther("0.5"));
      await treasury.connect(o1).execute(0);
      await expect(treasury.connect(o1).execute(0)).to.be.revertedWith("MS: already executed");
    });

    it("refuse un compte non proprietaire", async function () {
      const { treasury, o1, intrus, destinataire } = await deploy();
      await treasury.connect(o1).submit(destinataire.address, ethers.parseEther("0.5"));
      await expect(treasury.connect(intrus).execute(0)).to.be.revertedWith("MS: not owner");
    });
  });

  describe("confirm", function () {
    it("refuse une double confirmation du meme proprietaire", async function () {
      const { treasury, o1, destinataire } = await deploy();
      await treasury.connect(o1).submit(destinataire.address, ethers.parseEther("2"));
      await expect(treasury.connect(o1).confirm(0)).to.be.revertedWith("MS: already confirmed");
    });

    it("refuse une transaction inconnue", async function () {
      const { treasury, o1 } = await deploy();
      await expect(treasury.connect(o1).confirm(42)).to.be.revertedWith("MS: unknown tx");
    });

    it("refuse un compte non proprietaire", async function () {
      const { treasury, o1, intrus, destinataire } = await deploy();
      await treasury.connect(o1).submit(destinataire.address, ethers.parseEther("2"));
      await expect(treasury.connect(intrus).confirm(0)).to.be.revertedWith("MS: not owner");
    });

    it("refuse une transaction deja executee", async function () {
      const { treasury, o1, o2, destinataire } = await deploy();
      await treasury.connect(o1).submit(destinataire.address, ethers.parseEther("0.5"));
      await treasury.connect(o1).execute(0);
      await expect(treasury.connect(o2).confirm(0)).to.be.revertedWith("MS: already executed");
    });
  });

  describe("revoke", function () {
    it("retire la confirmation et bloque l'execution", async function () {
      const { treasury, o1, o2, destinataire } = await deploy();
      await treasury.connect(o1).submit(destinataire.address, ethers.parseEther("2"));
      await treasury.connect(o2).confirm(0);

      await expect(treasury.connect(o2).revoke(0))
        .to.emit(treasury, "Revoked")
        .withArgs(0n, o2.address);

      expect((await treasury.transactions(0)).confirmations).to.equal(1n);
      expect(await treasury.confirmed(0, o2.address)).to.equal(false);
      await expect(treasury.connect(o1).execute(0)).to.be.revertedWith(
        "MS: not enough confirmations",
      );
    });

    it("refuse de revoquer sans avoir confirme", async function () {
      const { treasury, o1, o3, destinataire } = await deploy();
      await treasury.connect(o1).submit(destinataire.address, ethers.parseEther("2"));
      await expect(treasury.connect(o3).revoke(0)).to.be.revertedWith("MS: not confirmed");
    });

    it("refuse une transaction deja executee", async function () {
      const { treasury, o1, destinataire } = await deploy();
      await treasury.connect(o1).submit(destinataire.address, ethers.parseEther("0.5"));
      await treasury.connect(o1).execute(0);
      await expect(treasury.connect(o1).revoke(0)).to.be.revertedWith("MS: already executed");
    });
  });
});