import fs from 'node:fs';
import path from 'pathe';
import * as v from 'valibot';
import { Err, Ok, type Result } from './blocks/types/result';

const CONFIG_NAME = 'jsrepo.json';

const formatterSchema = v.union([v.literal('prettier'), v.literal('biome')]);

const schema = v.object({
	$schema: v.string(),
	repos: v.optional(v.array(v.string()), []),
	includeTests: v.boolean(),
	path: v.pipe(v.string(), v.minLength(1)),
	watermark: v.optional(v.boolean(), true),
	formatter: v.optional(formatterSchema),
});

const getConfig = (cwd: string): Result<Config, string> => {
	if (!fs.existsSync(path.join(cwd, CONFIG_NAME))) {
		return Err('Could not find your configuration file! Please run `init`.');
	}

	const config = v.safeParse(
		schema,
		JSON.parse(fs.readFileSync(path.join(cwd, CONFIG_NAME)).toString())
	);

	if (!config.success) {
		return Err(`There was an error reading your \`${CONFIG_NAME}\` file!`);
	}

	return Ok(config.output);
};

type Config = v.InferOutput<typeof schema>;

type Formatter = v.InferOutput<typeof formatterSchema>;

export { type Config, type Formatter, CONFIG_NAME, getConfig, schema, formatterSchema };
