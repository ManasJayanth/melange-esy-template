const { promises: fs } = require("fs");
const path = require("path");
const installationJson = require("./_esy/default/installation.json");
const lockFile = require("./esy.lock/index.json");
const packageJson = require("./package.json");

async function copy(src, dest) {
  console.log("cp", "-R", src, dest);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.symlink(src, dest);
}

function getNode(lockFile, id) {
  return lockFile.node[id];
}

const getPkgMap = new Map();
function getPkg(id) {
  const pkg = getPkgMap.get(id);
  if (pkg) {
    return pkg;
  } else {
    try {
      const packageIDSansHash = getPackageIDSansHash(id);
      const versiono = getPackageIDSansHashToVersion(packageIDSansHash);
      const { name, version, opam } = versiono;
      const pkg = {
        id,
        name,
        version,
        opam,
      };
      getPkgMap.set(id, pkg);
      return pkg;
    } catch (e) {
      console.error(e);
      return { name: id };
    }
  }
}

function getNodeChildren(node) {
  const children = node.dependencies.concat(node.devDependencies);
  return children
    .map(getPkg)
    .filter((pkg) => {
      const { name, opam, version, id } = pkg;
      return !opam;
    })
    .map(({ id }) => id);
}

function getPackageIDSansHash(packageID) {
  return packageID.replace(/@[^@]+$/, "");
}

function getPackageIDSansHashToVersion(packageIDSansHash) {
  const matchResults = packageIDSansHash.match(
    /(?<name>@?[^@]+)@(?<opam>opam:)?(?<version>.+)/,
  );
  if (!matchResults) {
    throw new Error(
      `Could not parse name and version from ${packageIDSansHash}`,
    );
  }
  return matchResults.groups;
}

function getInstallationSrc(id, installationJson) {
  return installationJson[id];
}

async function loop(dependencyCountMap, rootNodeID) {
  const visitedForCount = new Map();
  let queue = [rootNodeID];
  do {
    const nodeID = queue.pop();
    if (!visitedForCount.get(nodeID)) {
      visitedForCount.set(nodeID, true);
      const children = getNodeChildren(getNode(lockFile, nodeID));
      for (let child of children) {
        const count = dependencyCountMap.get(child) || 0;
        dependencyCountMap.set(child, count + 1);
      }
      queue = queue.concat(children);
    }
  } while (queue.length);
  const hoistedDeps = new Set();
  for (let id of dependencyCountMap.keys()) {
    if (dependencyCountMap.get(id) > 1) {
      let { name } = getPkg(id);
      hoistedDeps.add(id);
    }
  }
  const visitedForCopy = new Map();
  const nodeModulesPath = path.join(process.cwd(), "node_modules");
  let stack = [{ id: rootNodeID, nodeModulesPath }].concat(
    Array.from(hoistedDeps.keys()).map((depID) => ({
      id: depID,
      nodeModulesPath,
    })),
  );
  do {
    const { id: nodeID, nodeModulesPath } = stack.shift();
    if (!visitedForCopy.get(nodeID)) {
      visitedForCopy.set(nodeID, true);
      let { name } = getPkg(nodeID);
      if (nodeID !== rootNodeID) {
        await copy(
          getInstallationSrc(nodeID, installationJson),
          path.join(nodeModulesPath, name),
        );
      }
      const children = getNodeChildren(getNode(lockFile, nodeID));
      for (let childID of children) {
        stack = stack.concat([
          {
            id: childID,
            nodeModulesPath:
              nodeID !== rootNodeID
                ? path.join(nodeModulesPath, name, "node_modules")
                : nodeModulesPath,
          },
        ]);
      }
    }
  } while (stack.length);
}

async function main() {
  const root = lockFile.root;
  return loop(new Map(), root);
}

main().then(console.log).catch(console.error);
