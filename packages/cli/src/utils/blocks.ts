import fs from 'node:fs';
import color from 'chalk';
import path from 'pathe';
import { Err, Ok, type Result } from './blocks/types/result';
import { mapToArray } from './blocks/utils/map-to-array';
import type { Block } from './build';
import type { Config } from './config';
import * as gitProviders from './git-providers';

export type RemoteBlock = Block & { sourceRepo: gitProviders.Info };

export type InstallingBlock = {
	name: string;
	subDependency: boolean;
	block: RemoteBlock;
};

const resolveTree = async (
	blockSpecifiers: string[],
	blocksMap: Map<string, RemoteBlock>,
	repoPaths: string[]
): Promise<Result<InstallingBlock[], string>> => {
	const blocks = new Map<string, InstallingBlock>();

	for (const blockSpecifier of blockSpecifiers) {
		let block: RemoteBlock | undefined = undefined;

		// if the block starts with github (or another provider) we know it has been resolved
		if (!gitProviders.providers.find((p) => blockSpecifier.startsWith(p.name()))) {
			if (repoPaths.length === 0) {
				return Err(
					color.red(
						`If your config doesn't repos then you must provide the repo in the block specifier ex: \`${color.bold(
							`github/<owner>/<name>/${blockSpecifier}`
						)}\`!`
					)
				);
			}

			// check every repo for the block and return the first block found
			for (const repo of repoPaths) {
				// we unwrap because we already checked this
				const providerInfo = (await gitProviders.getProviderInfo(repo)).unwrap();

				const tempBlock = blocksMap.get(
					`${providerInfo.name}/${providerInfo.owner}/${providerInfo.repoName}/${blockSpecifier}`
				);

				if (tempBlock === undefined) continue;

				block = tempBlock;

				break;
			}
		} else {
			// get shortened name
			const [providerName, owner, repoName, ...rest] = blockSpecifier.split('/');

			block = blocksMap.get(
				`${providerName}/${owner}/${repoName}/${rest.slice(rest.length - 2).join('/')}`
			);
		}

		if (!block) {
			return Err(`Invalid block! ${color.bold(blockSpecifier)} does not exist!`);
		}

		const specifier = `${block.category}/${block.name}`;

		blocks.set(specifier, { name: block.name, subDependency: false, block });

		if (block.localDependencies && block.localDependencies.length > 0) {
			const subDeps = await resolveTree(
				block.localDependencies.filter((dep) => !blocks.has(dep)),
				blocksMap,
				repoPaths
			);

			if (subDeps.isErr()) return Err(subDeps.unwrapErr());

			for (const dep of subDeps.unwrap()) {
				blocks.set(dep.name, dep);
			}
		}
	}

	return Ok(mapToArray(blocks, (_, val) => val));
};

type InstalledBlock = {
	specifier: `${string}/${string}`;
	path: string;
	block: Block;
};

/** Finds installed blocks and returns them as `<category>/<name>`
 *
 * @param blocks
 * @param config
 * @returns
 */
const getInstalled = (
	blocks: Map<string, Block>,
	config: Config,
	cwd: string
): InstalledBlock[] => {
	const installedBlocks: InstalledBlock[] = [];

	for (const [_, block] of blocks) {
		const baseDir = path.join(cwd, config.path, block.category);

		let blockPath = path.join(baseDir, block.files[0]);
		if (block.subdirectory) {
			blockPath = path.join(baseDir, block.name);
		}

		if (fs.existsSync(blockPath))
			installedBlocks.push({
				specifier: `${block.category}/${block.name}`,
				path: blockPath,
				block,
			});
	}

	return installedBlocks;
};

export { resolveTree, getInstalled };
