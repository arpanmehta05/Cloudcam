import { ServiceSchemas } from "../../../../config/terraform-schemas";

export function cleanConfigObject(config: any, defaults: any): any {
  const cleanedConfig = { ...(config || {}) };
  for (const [key, val] of Object.entries(cleanedConfig)) {
    if (
      val === null ||
      val === undefined ||
      (typeof val === "number" && !isFinite(val)) ||
      (typeof val === "string" &&
        (val.trim() === "" ||
          val.trim().toLowerCase() === "nan" ||
          val.trim().toLowerCase() === "null" ||
          val.trim().toLowerCase() === "undefined"))
    ) {
      delete cleanedConfig[key];
      continue;
    }

    if (defaults && typeof (defaults as any)[key] === "number") {
      const num = Number(val);
      if (isNaN(num) || !isFinite(num)) {
        delete cleanedConfig[key];
      } else {
        cleanedConfig[key] = num;
      }
    }
  }
  return cleanedConfig;
}

export function parseConfigSafely(schema: any, config: any): any {
  if (!schema) return config || {};

  let defaults = {};
  try {
    defaults = schema.parse({});
  } catch (e) {}

  const cleanedConfig = cleanConfigObject(config, defaults);
  const parseRes = schema.safeParse(cleanedConfig);
  if (parseRes.success) return parseRes.data;

  return {
    ...defaults,
    ...cleanedConfig,
  };
}

// Intercept all ServiceSchemas' parse methods to parse safely in the compiler
for (const [serviceId, schema] of Object.entries(ServiceSchemas)) {
  if (
    schema &&
    typeof schema.parse === "function" &&
    !(schema.parse as any).__patched
  ) {
    const originalParse = schema.parse.bind(schema);
    const patchedParse = (config: any) => {
      let defaults = {};
      try {
        defaults = originalParse({});
      } catch (e) {}

      const cleanedConfig = cleanConfigObject(config, defaults);
      const parseRes = schema.safeParse(cleanedConfig);
      if (parseRes.success) return parseRes.data;

      return {
        ...defaults,
        ...cleanedConfig,
      };
    };
    (patchedParse as any).__patched = true;
    schema.parse = patchedParse;
  }
}
