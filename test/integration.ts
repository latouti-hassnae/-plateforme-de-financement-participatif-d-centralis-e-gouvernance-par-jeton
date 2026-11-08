// test/Integration.ts
// Vrai CFDToken + vrai CrowdfundingCore + Governance (plus aucun mock)
import { expect } from "chai";
import { network } from "hardhat";

// TODO : copie ici la même ligne d'en-tête que dans test/Governance.ts
// si elle est différente (connexion au réseau Hardhat 3)
const { ethers, networkHelpers } = await network.connect();

const ETH = ethers.parseEther;
const JOUR = 24 * 3600;

// TODO : vérifier l'ordre de l'enum dans Governance.sol
const EARLY_RELEASE = 0;
const FREEZE = 1;

// Enum Status du Core : Active, Successful, Failed, Cancelled
const Status = { Active: 0, Successful: 1, Failed: 2, Cancelled: 3 };

// Helper : vérifie qu'une transaction échoue, quel que soit le message d'erreur
async function expectFail(p: Promise<unknown>) {
  let failed = false;
  try {
    await p;
  } catch {
    failed = true;
  }
  expect(failed, "la transaction aurait dû échouer").to.equal(true);
}

describe("Intégration : CFDToken + CrowdfundingCore + Governance", () => {
  async function deployAll() {
    const [admin, treasury, owner, alice, bob, carol] = await ethers.getSigners();

    // 1. Token
    const token = await ethers.deployContract("CFDToken", [admin.address]);

    // 2. Core : constructor(token_, treasury_, admin)
    const core = await ethers.deployContract("CrowdfundingCore", [
      await token.getAddress(),
      treasury.address,
      admin.address,
    ]);

    // 3. Governance : TODO vérifier le constructeur (token, core) dans Governance.sol
    const gov = await ethers.deployContract("Governance", [
      await token.getAddress(),
      await core.getAddress(),
    ]);

    // 4. Rôles
    await token.connect(admin).grantRole(await token.MINTER_ROLE(), await core.getAddress());
    await core.connect(admin).grantRole(await core.GOVERNANCE_ROLE(), await gov.getAddress());

    // 5. Campagne n°1 (les ids du Core commencent à 1) : objectif 4 ETH, 30 jours
    //    createCampaign(goal, durationSeconds, ipfsHash) ; le bénéficiaire = msg.sender
    await core.connect(owner).createCampaign(ETH("4"), 30 * JOUR, "ipfs://cid-de-test");

    // 6. Contributions : Alice 3 ETH, Bob 1 ETH -> objectif atteint
    await core.connect(alice).contribute(1, { value: ETH("3") });
    await core.connect(bob).contribute(1, { value: ETH("1") });

    return { token, core, gov, admin, treasury, owner, alice, bob, carol };
  }

  // TODO : vérifier dans Governance.sol si le premier id de proposition est 0 ou 1
  const PID = 1n;

  it("les contributions donnent des CFD au taux 1 ETH = 1000 CFD", async () => {
    const { token, core, alice, bob } = await deployAll();

    expect(await token.balanceOf(alice.address)).to.equal(ETH("3") * 1000n);
    expect(await token.balanceOf(bob.address)).to.equal(ETH("1") * 1000n);
    // Auto-délégation faite par le token : le pouvoir de vote existe sans delegate()
    expect(await token.getVotes(alice.address)).to.equal(ETH("3") * 1000n);
    expect(Number(await core.getStatus(1))).to.equal(Status.Successful);
  });

  it("déblocage anticipé : proposition -> votes -> 3 jours -> exécution -> retrait", async () => {
    const { core, gov, treasury, owner, alice, bob } = await deployAll();

    // Avant le vote : le bénéficiaire ne peut PAS retirer (échéance non atteinte)
    await expectFail(core.connect(owner).withdrawFunds(1));

    // Les contributions sont déjà minées : le snapshot (bloc précédent) les voit
    await gov.connect(alice).propose(1, EARLY_RELEASE, "Débloquer la campagne 1");

    await gov.connect(alice).vote(PID, true); // 3000 CFD pour
    await gov.connect(bob).vote(PID, false); // 1000 CFD contre

    await networkHelpers.time.increase(3 * JOUR + 1);
    await gov.execute(PID);

    // Le Core a bien reçu l'ordre
    const c = await core.getCampaign(1);
    expect(c.earlyReleaseApproved).to.equal(true);

    // Le retrait est maintenant possible, avec 2 % de frais pour la trésorerie
    const avant = await ethers.provider.getBalance(treasury.address);
    await core.connect(owner).withdrawFunds(1);
    const apres = await ethers.provider.getBalance(treasury.address);

    expect(apres - avant).to.equal(ETH("0.08")); // 2 % de 4 ETH
    expect((await core.getCampaign(1)).withdrawn).to.equal(true);
  });

  it("gel : proposition approuvée -> campagne annulée -> remboursement", async () => {
    const { token, core, gov, alice, bob } = await deployAll();

    await gov.connect(alice).propose(1, FREEZE, "Campagne suspecte");
    await gov.connect(alice).vote(PID, true);
    await gov.connect(bob).vote(PID, true);

    await networkHelpers.time.increase(3 * JOUR + 1);
    await gov.execute(PID);

    expect((await core.getCampaign(1)).frozen).to.equal(true);
    expect(Number(await core.getStatus(1))).to.equal(Status.Cancelled);

    // Alice peut se faire rembourser ses 3 ETH
    const avant = await ethers.provider.getBalance(alice.address);
    const tx = await core.connect(alice).refund(1);
    const rec = await tx.wait();
    const gas = rec!.gasUsed * rec!.gasPrice;
    const apres = await ethers.provider.getBalance(alice.address);
    expect(apres - avant + gas).to.equal(ETH("3"));

    // Limite connue (à documenter dans le rapport) : Alice garde ses CFD
    expect(await token.balanceOf(alice.address)).to.equal(ETH("3") * 1000n);
  });

  it("sécurité : un contributeur arrivé APRÈS la proposition n'a aucun poids de vote", async () => {
    const { token, core, gov, alice, carol } = await deployAll();

    await gov.connect(alice).propose(1, FREEZE, "Test snapshot");

    // Carol contribue après la proposition : elle reçoit des CFD...
    // (la campagne est encore ouverte : 30 jours)
    await core.connect(carol).contribute(1, { value: ETH("10") });
    expect(await token.balanceOf(carol.address)).to.equal(ETH("10") * 1000n);

    // ... mais son vote ne compte pas.
    // TODO : copie la vérification du test n°12 de test/Governance.ts
    // (soit le vote est refusé, soit le total des "pour" ne change pas)
    await gov.connect(alice).vote(PID, true);
    let carolAPuVoter = true;
    try {
      await gov.connect(carol).vote(PID, true);
    } catch {
      carolAPuVoter = false;
    }
    expect(carolAPuVoter, "Carol ne doit pas pouvoir voter").to.equal(false);
});
});