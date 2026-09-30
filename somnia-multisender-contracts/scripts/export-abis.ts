import * as fs from "fs";
import * as path from "path";

function main() {
  const artifactsDir = path.join(process.cwd(), "artifacts", "contracts");
  const exportDir = path.join(process.cwd(), "exported-abis");

  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const contracts = [
    { name: "Multisender", path: "Multisender.sol/Multisender.json" },
    { name: "GasPool", path: "GasPool.sol/GasPool.json" },
    { name: "MockERC20", path: "test/MockERC20.sol/MockERC20.json" },
  ];

  for (const c of contracts) {
    const artifactPath = path.join(artifactsDir, c.path);
    if (fs.existsSync(artifactPath)) {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
      fs.writeFileSync(
        path.join(exportDir, `${c.name}.json`),
        JSON.stringify({ contractName: c.name, abi: artifact.abi }, null, 2)
      );
      console.log(`Exported ABI for ${c.name}`);
    }
  }

  console.log("ABI export complete!");
}

main();
