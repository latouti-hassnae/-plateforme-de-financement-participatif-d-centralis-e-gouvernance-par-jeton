import { readFileSync } from "node:fs";

const lignes = readFileSync(".env", "utf8").split(/\r?\n/);
lignes.forEach((l, i) => {
  if (!l.trim() || l.trim().startsWith("#")) return;
  const [nom, ...reste] = l.split("=");
  const valeur = reste.join("=").trim();
  let info = `${valeur.length} caractères`;
  if (valeur.startsWith("http")) {
    try { info = "hôte = " + new URL(valeur).hostname; } catch { info = "URL invalide"; }
  }
  console.log(`ligne ${i + 1} : ${nom.trim()} -> ${info}`);
});