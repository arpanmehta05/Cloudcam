import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";
import { ServiceSchemas } from "../../../../../../config/terraform-schemas";

export class AwsCloudfrontCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, deps, providerData } = args;

    const getConnectedNodes = (serviceId: string) => {
      return compiler.req.nodes.filter(
        (n) =>
          n.serviceId === serviceId &&
          (compiler.req.edges?.some(
            (e) =>
              (e.source === node.id && e.target === n.id) ||
              (e.source === n.id && e.target === node.id),
          ) ??
            false),
      );
    };

    const connectedS3Nodes = getConnectedNodes("s3");
    const connectedElbNodes = getConnectedNodes("elb");
    const connectedApiNodes = getConnectedNodes("apigateway");

    let resolvedOriginType = config.originType || "S3";
    let originDomain = config.originDomainName || "";
    let originId = `${resolvedOriginType}-${name}`;
    let customOriginConfig: any = undefined;
    let oacId: string | undefined = undefined;
    const additionalDeps: string[] = [];

    if (connectedS3Nodes.length > 0) {
      resolvedOriginType = "S3";
      const s3Node = connectedS3Nodes[0];
      const s3Name = `sim_${s3Node.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      originDomain = resolveInterpolation(
        "aws_s3_bucket",
        s3Name,
        "bucket_regional_domain_name",
      );
      originId = `S3-${s3Name}`;
      additionalDeps.push(`aws_s3_bucket.${s3Name}`);

      if (config.allowPrivateBucketAccess) {
        const oacName = `${name}_oac`;
        compiler.addResource(
          "aws_cloudfront_origin_access_control",
          oacName,
          {
            ...providerData,
            name: `${config.distributionName || name}-oac`,
            description: "OAC for S3 simulation",
            origin_access_control_origin_type: "s3",
            signing_behavior: "always",
            signing_protocol: "sigv4",
          },
          "cloudfront",
          true,
          deps,
        );
        oacId = resolveInterpolation(
          "aws_cloudfront_origin_access_control",
          oacName,
          "id",
        );
        additionalDeps.push(`aws_cloudfront_origin_access_control.${oacName}`);

        const policyObj = {
          Version: "2012-10-17",
          Statement: [
            {
              Sid: "AllowCloudFrontServicePrincipalReadOnly",
              Effect: "Allow",
              Principal: {
                Service: "cloudfront.amazonaws.com",
              },
              Action: "s3:GetObject",
              Resource: `\${aws_s3_bucket.${s3Name}.arn}/*`,
              Condition: {
                StringEquals: {
                  "AWS:SourceArn": `\${aws_cloudfront_distribution.${name}.arn}`,
                },
              },
            },
          ],
        };
        compiler.addResource(
          "aws_s3_bucket_policy",
          `${s3Name}_cf_policy`,
          {
            ...providerData,
            bucket: resolveInterpolation("aws_s3_bucket", s3Name, "id"),
            policy: JSON.stringify(policyObj),
          },
          "cloudfront",
          true,
          [`aws_s3_bucket.${s3Name}`, `aws_cloudfront_distribution.${name}`],
        );
      }
    } else if (connectedElbNodes.length > 0) {
      resolvedOriginType = "ELB";
      const elbNode = connectedElbNodes[0];
      const elbName = `sim_${elbNode.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      originDomain = resolveInterpolation("aws_lb", elbName, "dns_name");
      originId = `ELB-${elbName}`;
      additionalDeps.push(`aws_lb.${elbName}`);
      customOriginConfig = {
        http_port: 80,
        https_port: 443,
        origin_protocol_policy: config.originProtocolPolicy || "https-only",
        origin_ssl_protocols: ["TLSv1.2"],
      };
    } else if (connectedApiNodes.length > 0) {
      resolvedOriginType = "APIGateway";
      const apiNode = connectedApiNodes[0];
      const apiName = `sim_${apiNode.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      originDomain = `\${replace(aws_apigatewayv2_api.${apiName}.api_endpoint, "https://", "")}`;
      originId = `APIGateway-${apiName}`;
      additionalDeps.push(`aws_apigatewayv2_api.${apiName}`);
      customOriginConfig = {
        http_port: 80,
        https_port: 443,
        origin_protocol_policy: "https-only",
        origin_ssl_protocols: ["TLSv1.2"],
      };
    } else {
      if (resolvedOriginType === "S3") {
        if (config.allowPrivateBucketAccess) {
          const oacName = `${name}_oac`;
          compiler.addResource(
            "aws_cloudfront_origin_access_control",
            oacName,
            {
              ...providerData,
              name: `${config.distributionName || name}-oac`,
              description: "OAC for S3 simulation",
              origin_access_control_origin_type: "s3",
              signing_behavior: "always",
              signing_protocol: "sigv4",
            },
            "cloudfront",
            true,
            deps,
          );
          oacId = resolveInterpolation(
            "aws_cloudfront_origin_access_control",
            oacName,
            "id",
          );
          additionalDeps.push(
            `aws_cloudfront_origin_access_control.${oacName}`,
          );
        }
      } else if (
        resolvedOriginType === "ELB" ||
        resolvedOriginType === "APIGateway" ||
        resolvedOriginType === "MediaPackage" ||
        resolvedOriginType === "Other"
      ) {
        customOriginConfig = {
          http_port: 80,
          https_port: 443,
          origin_protocol_policy: config.originProtocolPolicy || "https-only",
          origin_ssl_protocols: ["TLSv1.2"],
        };
      }
    }

    const originBlock: any = {
      domain_name: originDomain,
      origin_id: originId,
    };

    if (config.originPath) {
      originBlock.origin_path = config.originPath;
    }

    if (oacId) {
      originBlock.origin_access_control_id = oacId;
    }

    if (customOriginConfig) {
      originBlock.custom_origin_config = customOriginConfig;
    }

    let vpcOriginConfig: any = undefined;
    if (resolvedOriginType === "VPCOrigin") {
      vpcOriginConfig = {
        origin_keepalive_timeout: 5,
        origin_read_timeout: 30,
        vpc_origin_id: `vpco-${name}`,
      };
      originBlock.vpc_origin_config = vpcOriginConfig;
    }

    const allowedMethods =
      resolvedOriginType === "ELB" ||
      resolvedOriginType === "APIGateway" ||
      resolvedOriginType === "Other"
        ? ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
        : ["GET", "HEAD", "OPTIONS"];

    const defaultCacheBehavior = {
      allowed_methods: allowedMethods,
      cached_methods: ["GET", "HEAD"],
      target_origin_id: originId,
      forwarded_values: {
        query_string: false,
        cookies: {
          forward: "none",
        },
      },
      viewer_protocol_policy: "redirect-to-https",
      min_ttl: 0,
      default_ttl: config.defaultCacheTtl ?? 86400,
      max_ttl: 31536000,
    };

    let webAclId: string | undefined = undefined;
    if (config.enableWaf) {
      const wafName = `${name}_waf`;
      compiler.addResource(
        "aws_wafv2_web_acl",
        wafName,
        {
          ...providerData,
          name: `${config.distributionName || name}-waf`,
          scope: "CLOUDFRONT",
          default_action: {
            allow: {},
          },
          visibility_config: {
            cloudwatch_metrics_enabled: true,
            metric_name: `${name}_waf_metric`
              .substring(0, 32)
              .replace(/[^a-zA-Z0-9]/g, ""),
            sampled_requests_enabled: true,
          },
        },
        "cloudfront",
        true,
        deps,
        ["default_action", "allow", "visibility_config"],
      );
      webAclId = resolveInterpolation("aws_wafv2_web_acl", wafName, "arn");
      additionalDeps.push(`aws_wafv2_web_acl.${wafName}`);
    }

    compiler.addResource(
      "aws_cloudfront_distribution",
      name,
      {
        ...providerData,
        enabled: config.enabled ?? true,
        comment: config.description || "CloudFront distribution simulation",
        price_class: config.priceClass || "PriceClass_All",
        origin: [originBlock],
        default_cache_behavior: defaultCacheBehavior,
        restrictions: {
          geo_restriction: {
            restriction_type: "none",
          },
        },
        viewer_certificate: {
          cloudfront_default_certificate: true,
        },
        web_acl_id: webAclId,
      },
      "cloudfront",
      false,
      [...deps, ...additionalDeps],
      [
        "origin",
        "custom_origin_config",
        "vpc_origin_config",
        "default_cache_behavior",
        "forwarded_values",
        "cookies",
        "restrictions",
        "geo_restriction",
        "viewer_certificate",
      ],
    );
  }
}
