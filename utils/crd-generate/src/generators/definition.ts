import {
  Definition,
  generateImports,
  generateInterface,
  getAPIVersion,
  GroupVersionKind,
  Import,
  OutputFile
} from "@kubernetes-models/generate";
import { GenerateOptions } from "../generate";
import { formatComment, trimSuffix } from "@kubernetes-models/string-util";
import { getRelativePath, getSchemaPath } from "../utils";

function getFieldType(key: string[]): string | undefined {
  if (key.length === 1 && key[0] === "metadata") {
    return "IObjectMeta";
  }
}

function generateDefinition(
  gvk: GroupVersionKind,
  def: Definition,
  options: GenerateOptions
): OutputFile {
  const apiVersion = getAPIVersion(gvk);
  const className = `Model${gvk.kind}`;
  const exportName = gvk.kind;
  const interfaceName = `I${exportName}`;
  const imports: Import[] = [];
  const interfaceContent = generateInterface(def.schema, {
    includeDescription: true,
    getFieldType
  });
  const path = `${apiVersion}/${exportName}.ts`;
  let classContent = generateInterface(def.schema, {
    getFieldType(key) {
      if (key.length === 1) {
        return `${interfaceName}${JSON.stringify(key)}`;
      }
    }
  });
  let comment = "";

  classContent =
    trimSuffix(classContent, "}") +
    `
static apiVersion: ${interfaceName}["apiVersion"] = ${JSON.stringify(
      apiVersion
    )};
static kind: ${interfaceName}["kind"] = ${JSON.stringify(gvk.kind)};
static is = createTypeMetaGuard<${interfaceName}>(${className});

constructor(data?: ModelData<${interfaceName}>) {
  super();

  this.setDefinedProps({
    apiVersion: ${className}.apiVersion,
    kind: ${className}.kind,
    ...data
  } as ${interfaceName});
}
}
`;

  imports.push({
    name: "IObjectMeta",
    path: "@kubernetes-models/apimachinery/apis/meta/v1/ObjectMeta"
  });

  imports.push({
    alias: "Model",
    name: options.customBaseClassName as string,
    path: options.customBaseClassImportPath as string
  });

  imports.push({
    name: "ModelData",
    path: "@kubernetes-models/base"
  });

  imports.push({
    name: "setValidateFunc",
    path: "@kubernetes-models/base"
  });

  imports.push({
    name: "createTypeMetaGuard",
    path: "@kubernetes-models/base"
  });

  imports.push({
    name: "ValidateFunc",
    path: "@kubernetes-models/validate"
  });

  imports.push({
    name: "validate",
    path: getRelativePath(path, getSchemaPath(def.schemaId))
  });

  // Add model wrapper import if specified
  if (options?.modelWrapper && options?.modelWrapperPath) {
    // `modelWrapper` must be a valid TS identifier since we import it as a named import.
    // The wrapper is expected to return a constructable model so we can call `setValidateFunc()`.
    imports.push({
      name: options.modelWrapper,
      path: options.modelWrapperPath
    });
  }

  if (def.schema.description) {
    comment = formatComment(def.schema.description, {
      deprecated: /^deprecated/i.test(def.schema.description)
    });
  }

  const exportModel = options?.modelWrapper
    ? `export const ${exportName} = ${options.modelWrapper}(${className}, ${JSON.stringify(gvk.group)}, ${JSON.stringify(gvk.kind)});`
    : `export {\n  ${className} as ${exportName}\n};`;

  const exportType = `export type ${exportName} = InstanceType<typeof ${exportName}>;`;

  const validateTarget = options?.modelWrapper ? exportName : className;

  return {
    path,
    content: `${generateImports(imports)}

 ${comment}export interface ${interfaceName} ${interfaceContent}

${comment}class ${className} extends Model<${interfaceName}> implements ${interfaceName} ${classContent}

${exportModel}

${exportType}

setValidateFunc(${validateTarget}, validate as ValidateFunc<${interfaceName}>);
`
  };
}

const generateDefinitions = async (
  definitions: readonly Definition[],
  options: GenerateOptions
): Promise<OutputFile[]> => {
  const output: OutputFile[] = [];

  for (const def of definitions) {
    const gvks = def.gvk;

    if (gvks && gvks.length) {
      output.push(generateDefinition(gvks[0], def, options));
    }
  }

  return output;
};

export default generateDefinitions;
