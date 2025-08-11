import yargs from "yargs";
import { readInput } from "@kubernetes-models/read-input";
import { generate, GenerateOptions } from "./generate";

async function readFiles(paths: string[]): Promise<string> {
  const documents: string[] = [];

  for (const path of paths) {
    console.log("Reading:", path);
    documents.push(await readInput(path));
  }

  return documents.join("\n---\n");
}

export async function run(): Promise<void> {
  const args = await yargs
    .pkgConf("crd-generate")
    .option("input", {
      type: "array",
      describe: "Path of the input file or URL",
      string: true,
      demandOption: true
    })
    .option("output", {
      type: "string",
      describe: "Path of output files",
      demandOption: true
    })
    .option("yamlVersion", {
      type: "string",
      describe: "YAML version.",
      choices: ["1.0", "1.1", "1.2"]
    })
    .option("modelDecorator", {
      type: "string",
      describe:
        "Optional decorator to apply to model classes (e.g., '@MyDecorator()')"
    })
    .option("modelDecoratorPath", {
      type: "string",
      describe: "Import path for the model decorator"
    })
    .check((argv) => {
      // Validate that both decorator options are provided together or neither is provided
      const hasDecorator = !!argv.modelDecorator;
      const hasDecoratorPath = !!argv.modelDecoratorPath;

      if (hasDecorator && !hasDecoratorPath) {
        throw new Error(
          "modelDecoratorPath is required when modelDecorator is provided"
        );
      }

      if (hasDecoratorPath && !hasDecorator) {
        throw new Error(
          "modelDecorator is required when modelDecoratorPath is provided"
        );
      }

      return true;
    })
    .parse();

  try {
    await generate({
      input: await readFiles(args.input),
      outputPath: args.output,
      yamlVersion: args.yamlVersion as GenerateOptions["yamlVersion"],
      modelDecorator: args.modelDecorator,
      modelDecoratorPath: args.modelDecoratorPath
    });
  } catch (err) {
    console.error(err);
    // eslint-disable-next-line no-process-exit
    process.exit(1);
  }
}
