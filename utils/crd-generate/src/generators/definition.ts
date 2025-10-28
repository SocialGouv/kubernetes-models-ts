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

  // Add decorator import if specified
  let decoratorName = "";
  if (options?.modelDecorator && options?.modelDecoratorPath) {
    // Extract decorator name from the decorator string (remove @ and parentheses)
    const decoratorMatch = options.modelDecorator.match(
      /^@?([A-Za-z_$][A-Za-z0-9_$]*)/
    );
    if (decoratorMatch) {
      decoratorName = decoratorMatch[1];
      imports.push({
        name: decoratorName,
        path: options.modelDecoratorPath
      });
    }
  }

  if (def.schema.description) {
    comment = formatComment(def.schema.description, {
      deprecated: /^deprecated/i.test(def.schema.description)
    });
  }

  // Apply decorator to class if specified
  const decoratorLine = options?.modelDecorator
    ? `${options.modelDecorator}(${JSON.stringify(gvk.group)}, ${JSON.stringify(gvk.kind)})\n`
    : "";

  return {
    path,
    content: `${generateImports(imports)}

${comment}export interface ${interfaceName} ${interfaceContent}

${comment}${decoratorLine} class ${className} extends Model<${interfaceName}> implements ${interfaceName} ${classContent}

export {
  ${className} as ${exportName}
};

setValidateFunc(${className}, validate as ValidateFunc<${interfaceName}>);
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
