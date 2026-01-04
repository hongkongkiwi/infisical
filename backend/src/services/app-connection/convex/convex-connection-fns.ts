import { AxiosError } from "axios";

import { request } from "@app/lib/config/request";
import { BadRequestError } from "@app/lib/errors";
import { blockLocalAndPrivateIpAddresses } from "@app/lib/validator";
import { AppConnection } from "@app/services/app-connection/app-connection-enums";

import { ConvexConnectionMethod } from "./convex-connection-constants";
import { TConvexConnectionConfig } from "./convex-connection-types";

export const getConvexConnectionListItem = () => {
  return {
    name: "Convex" as const,
    app: AppConnection.Convex as const,
    methods: Object.values(ConvexConnectionMethod)
  };
};

const getDeploymentNameFromAdminKey = (adminKey: string) => {
  const [deploymentSegment] = adminKey.split("|");

  if (!deploymentSegment) return null;

  const candidate = deploymentSegment.includes(":")
    ? deploymentSegment.split(":").filter(Boolean).pop()
    : deploymentSegment;

  if (!candidate) return null;

  return /^[a-z0-9-]+$/.test(candidate) ? candidate : null;
};

const getDeploymentUrlFromAdminKey = async (adminKey: string) => {
  const deploymentName = getDeploymentNameFromAdminKey(adminKey);

  if (!deploymentName) return null;

  const deploymentUrl = `https://${deploymentName}.convex.cloud`;
  await blockLocalAndPrivateIpAddresses(deploymentUrl);

  return deploymentUrl;
};

export const validateConvexConnectionCredentials = async ({ credentials }: TConvexConnectionConfig) => {
  const { adminKey } = credentials;
  const deploymentUrl = await getDeploymentUrlFromAdminKey(adminKey);

  if (!deploymentUrl) return credentials;

  try {
    await request.get(`${deploymentUrl}/api/v1/list_environment_variables`, {
      headers: {
        Authorization: `Convex ${adminKey}`,
        Accept: "application/json"
      }
    });
  } catch (error: unknown) {
    if (error instanceof AxiosError) {
      const responseData: unknown = error.response?.data;
      const details = responseData ? JSON.stringify(responseData) : error.message || "Unknown error";
      throw new BadRequestError({
        message: `Failed to validate credentials: ${details}`
      });
    }

    throw new BadRequestError({
      message: `Unable to validate connection: ${(error as Error).message || "Verify credentials"}`
    });
  }

  return credentials;
};
