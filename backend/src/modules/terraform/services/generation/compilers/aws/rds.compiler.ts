import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";
import { ServiceSchemas } from "../../../../../../config/terraform-schemas";

export class AwsRdsCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, suffix, deps, providerData } = args;
    compiler.addResource(
      "aws_db_instance",
      name,
      {
        ...providerData,
        engine: config.engine,
        instance_class: config.instanceClass,
        allocated_storage: config.storageGb,
        db_name: config.dbName,
        port: config.port,
        username: "dbadmin",
        password: "Rabbittize1234!",
        multi_az: config.multiAz,
        skip_final_snapshot: true,
        vpc_security_group_ids: [
          resolveInterpolation("aws_security_group", suffix, "id"),
        ],
        db_subnet_group_name: resolveInterpolation(
          "aws_db_subnet_group",
          `dsg_${suffix}`,
          "name",
        ),
      },
      "rds",
      false,
      [
        `aws_security_group.${suffix}`,
        `aws_db_subnet_group.dsg_${suffix}`,
        ...deps,
      ],
    );
  }
}
