import { Request, Response } from "express";
import { User, encryptKey, decryptKey } from "../../../models/user.model";
import { config } from "../../../config/env";

export async function githubStatus(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const connected = !!user.githubCredentials?.accessToken;
    return res.json({ success: true, connected });
  } catch (err: any) {
    console.error("[githubStatus] Error:", err);
    return res
      .status(500)
      .json({ success: false, error: err.message || "Failed to check status" });
  }
}

export async function githubConnect(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId;
    const { code, redirectUri } = req.body;

    if (!code || !redirectUri) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Missing authorization code or redirect URI",
        });
    }

    if (!config.oauth.github.clientId || !config.oauth.github.clientSecret) {
      return res
        .status(500)
        .json({
          success: false,
          error: "GitHub OAuth is not configured on the server",
        });
    }

    // Exchange code for access token
    const tokenRes = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          code,
          client_id: config.oauth.github.clientId,
          client_secret: config.oauth.github.clientSecret,
          redirect_uri: redirectUri,
        }),
      },
    );

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      return res
        .status(400)
        .json({
          success: false,
          error: `GitHub OAuth code exchange failed: ${errorText}`,
        });
    }

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };
    if (tokenData.error) {
      return res
        .status(400)
        .json({
          success: false,
          error: tokenData.error_description || tokenData.error,
        });
    }
    if (!tokenData.access_token) {
      return res
        .status(400)
        .json({
          success: false,
          error: "GitHub did not return an access token",
        });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    user.githubCredentials = {
      accessToken: encryptKey(tokenData.access_token),
      connectedAt: new Date(),
    };

    await user.save();
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[githubConnect] Error:", err);
    return res
      .status(500)
      .json({
        success: false,
        error: err.message || "Failed to connect GitHub account",
      });
  }
}

export async function githubDisconnect(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    user.githubCredentials = {
      accessToken: null as any,
      connectedAt: null as any,
    };

    await user.save();
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[githubDisconnect] Error:", err);
    return res
      .status(500)
      .json({
        success: false,
        error: err.message || "Failed to disconnect GitHub account",
      });
  }
}

export async function githubRepos(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId;
    const user = await User.findById(userId);
    if (!user || !user.githubCredentials?.accessToken) {
      return res
        .status(400)
        .json({ success: false, error: "GitHub account not connected" });
    }

    const token = decryptKey(user.githubCredentials.accessToken);

    // Call GitHub API to list repositories
    const reposRes = await fetch(
      "https://api.github.com/user/repos?per_page=100&sort=updated",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "Rabbittize-Backend",
        },
      },
    );

    if (!reposRes.ok) {
      const errorText = await reposRes.text();
      return res
        .status(400)
        .json({
          success: false,
          error: `Failed to fetch repos from GitHub: ${errorText}`,
        });
    }

    const reposData = (await reposRes.json()) as any[];
    const repos = reposData.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner.login,
      cloneUrl: repo.clone_url,
      private: repo.private,
      description: repo.description,
      defaultBranch: repo.default_branch,
    }));

    return res.json({ success: true, repos });
  } catch (err: any) {
    console.error("[githubRepos] Error:", err);
    return res
      .status(500)
      .json({
        success: false,
        error: err.message || "Failed to fetch repositories",
      });
  }
}

export async function githubBranches(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId;
    const user = await User.findById(userId);
    if (!user || !user.githubCredentials?.accessToken) {
      return res
        .status(400)
        .json({ success: false, error: "GitHub account not connected" });
    }

    const { repo } = req.query; // Expecting owner/name
    if (!repo || typeof repo !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "Missing repo parameter" });
    }

    const token = decryptKey(user.githubCredentials.accessToken);

    // Call GitHub API to list branches
    const branchesRes = await fetch(
      `https://api.github.com/repos/${repo}/branches?per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "Rabbittize-Backend",
        },
      },
    );

    if (!branchesRes.ok) {
      const errorText = await branchesRes.text();
      return res
        .status(400)
        .json({
          success: false,
          error: `Failed to fetch branches from GitHub: ${errorText}`,
        });
    }

    const branchesData = (await branchesRes.json()) as any[];
    const branches = branchesData.map((branch: any) => ({
      name: branch.name,
      protected: branch.protected,
    }));

    return res.json({ success: true, branches });
  } catch (err: any) {
    console.error("[githubBranches] Error:", err);
    return res
      .status(500)
      .json({
        success: false,
        error: err.message || "Failed to fetch branches",
      });
  }
}
