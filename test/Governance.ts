import assert from "node:assert/strict";
import { network } from "hardhat";

const { ethers } = await network.connect();

const THREE_DAYS = 3 * 24 * 60 * 60;
const E18 = (n: number) => ethers.parseEther(n.toString());

// Avance le temps de la blockchain locale
async function increaseTime(seconds: number) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

describe("Governance", () => {
  let token: any, core: any, governance: any;
  let alice: any, bob: any, carol: any, attacker: any;

  const CAMPAIGN_ID = 1;
  const EARLY_RELEASE = 0;
  const FREEZE = 1;

  beforeEach(async () => {
    [, alice, bob, carol, attacker] = await ethers.getSigners();

    token = await ethers.deployContract("MockToken");
    core = await ethers.deployContract("MockCore");
    governance = await ethers.deployContract("Governance", [
      await token.getAddress(),
      await core.getAddress(),
    ]);

    // Supply total = 1000 CFD : alice 60 %, bob 30 %, carol 10 %
    await token.mint(alice.address, E18(600));
    await token.mint(bob.address, E18(300));
    await token.mint(carol.address, E18(100));

    // Avec ERC20Votes, il faut se déléguer à soi-même pour avoir du poids
    await token.connect(alice).delegate(alice.address);
    await token.connect(bob).delegate(bob.address);
    await token.connect(carol).delegate(carol.address);
  });

  it("permet à un détenteur de jetons de créer une proposition", async () => {
    await governance
      .connect(alice)
      .propose(CAMPAIGN_ID, EARLY_RELEASE, "Déblocage anticipé");
    assert.equal(await governance.proposalCount(), 1n);
  });

  it("refuse une proposition sans pouvoir de vote", async () => {
    await assert.rejects(
      governance.connect(attacker).propose(CAMPAIGN_ID, EARLY_RELEASE, "x"),
      /No voting power/
    );
  });

  it("compte le poids du vote égal au solde au snapshot", async () => {
    await governance.connect(alice).propose(CAMPAIGN_ID, EARLY_RELEASE, "x");
    await governance.connect(alice).vote(1, true);

    const p = await governance.proposals(1);
    assert.equal(p.forVotes, E18(600));
    assert.equal(p.againstVotes, 0n);
  });

  it("refuse le double vote", async () => {
    await governance.connect(alice).propose(CAMPAIGN_ID, EARLY_RELEASE, "x");
    await governance.connect(alice).vote(1, true);

    await assert.rejects(
      governance.connect(alice).vote(1, true),
      /Already voted/
    );
  });

  it("refuse le vote après la fin de la période", async () => {
    await governance.connect(alice).propose(CAMPAIGN_ID, EARLY_RELEASE, "x");
    await increaseTime(THREE_DAYS + 1);

    await assert.rejects(
      governance.connect(bob).vote(1, true),
      /Voting closed/
    );
  });

  it("refuse l'exécution avant la fin du vote", async () => {
    await governance.connect(alice).propose(CAMPAIGN_ID, EARLY_RELEASE, "x");
    await governance.connect(alice).vote(1, true);

    await assert.rejects(governance.execute(1), /Voting not ended/);
  });

  it("refuse l'exécution si le quorum n'est pas atteint", async () => {
    await governance.connect(alice).propose(CAMPAIGN_ID, EARLY_RELEASE, "x");
    // personne ne vote
    await increaseTime(THREE_DAYS + 1);

    await assert.rejects(governance.execute(1), /Quorum not reached/);
  });

  it("refuse l'exécution si la majorité n'est pas atteinte", async () => {
    await governance.connect(alice).propose(CAMPAIGN_ID, EARLY_RELEASE, "x");
    await governance.connect(alice).vote(1, false); // 600 contre
    await governance.connect(bob).vote(1, true); // 300 pour
    await increaseTime(THREE_DAYS + 1);

    await assert.rejects(governance.execute(1), /Majority not reached/);
  });

  it("exécute un déblocage anticipé approuvé", async () => {
    await governance.connect(alice).propose(CAMPAIGN_ID, EARLY_RELEASE, "x");
    await governance.connect(alice).vote(1, true);
    await governance.connect(bob).vote(1, true);
    await increaseTime(THREE_DAYS + 1);

    await governance.execute(1);

    assert.equal(await core.released(CAMPAIGN_ID), true);
    assert.equal(await core.frozen(CAMPAIGN_ID), false);
  });

  it("exécute le gel d'une campagne approuvé", async () => {
    await governance.connect(alice).propose(CAMPAIGN_ID, FREEZE, "Campagne suspecte");
    await governance.connect(alice).vote(1, true);
    await increaseTime(THREE_DAYS + 1);

    await governance.execute(1);

    assert.equal(await core.frozen(CAMPAIGN_ID), true);
  });

  it("refuse une double exécution", async () => {
    await governance.connect(alice).propose(CAMPAIGN_ID, EARLY_RELEASE, "x");
    await governance.connect(alice).vote(1, true);
    await increaseTime(THREE_DAYS + 1);

    await governance.execute(1);
    await assert.rejects(governance.execute(1), /Already executed/);
  });

  // ===== Test de sécurité : anti-manipulation de la gouvernance =====
  it("ignore les jetons achetés après la création de la proposition (snapshot)", async () => {
    await governance.connect(alice).propose(CAMPAIGN_ID, EARLY_RELEASE, "x");

    // L'attaquant acquiert massivement des jetons APRÈS la proposition
    await token.mint(attacker.address, E18(100000));
    await token.connect(attacker).delegate(attacker.address);

    // Son poids au snapshot est 0 : le vote est refusé
    await assert.rejects(
      governance.connect(attacker).vote(1, true),
      /No voting power at snapshot/
    );

    // Les votes des vrais détenteurs restent inchangés
    await governance.connect(bob).vote(1, false);
    const p = await governance.proposals(1);
    assert.equal(p.forVotes, 0n);
    assert.equal(p.againstVotes, E18(300));
  });
});