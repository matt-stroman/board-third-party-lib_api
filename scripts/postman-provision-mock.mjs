import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function getArgValue(name, defaultValue = "") {
  const index = process.argv.indexOf(name);
  if (index < 0 || index + 1 >= process.argv.length) {
    return defaultValue;
  }

  return process.argv[index + 1];
}

function writeGithubOutput(key, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    return;
  }

  fs.appendFileSync(outputPath, `${key}=${value}\n`);
}

function getEnvValue(envJson, key) {
  const found = (envJson.values || []).find((value) => value && value.key === key);
  return typeof found?.value === "string" ? found.value.trim() : "";
}

function uniqueNonEmpty(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim().length > 0))];
}

function buildNameCandidates(preferredName) {
  if (!preferredName) {
    return [];
  }

  return uniqueNonEmpty([preferredName.trim()]);
}

function resolveEntityByIdOrName(entities, preferredId, preferredName) {
  const candidateNames = buildNameCandidates(preferredName);
  let entity = null;

  if (preferredId) {
    entity = entities.find((candidate) => candidate && String(candidate.id || "") === preferredId) || null;
  }

  if (!entity && candidateNames.length > 0) {
    entity =
      entities.find((candidate) => candidate && candidateNames.includes(String(candidate.name || ""))) || null;
  }

  return {
    entity,
    candidateNames
  };
}

function stripPostmanIds(value) {
  if (Array.isArray(value)) {
    return value.map(stripPostmanIds);
  }

  if (value && typeof value === "object") {
    const result = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === "id" || key === "uid" || key === "_postman_id") {
        continue;
      }

      result[key] = stripPostmanIds(child);
    }

    return result;
  }

  return value;
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${url} failed: ${response.status}\n${text}`);
  }

  return payload;
}

function isDeepUpdateConflict(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes(" failed: 409") && message.toLowerCase().includes("deepupdate");
}

async function delay(milliseconds) {
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function requestJsonWithRetry(url, options, retryCount = 5) {
  let attempt = 0;

  while (true) {
    try {
      return await requestJson(url, options);
    } catch (error) {
      attempt += 1;

      if (attempt >= retryCount || !isDeepUpdateConflict(error)) {
        throw error;
      }

      await delay(attempt * 1000);
    }
  }
}

async function deleteMocksByName(apiBase, apiKey, mockName) {
  const payload = await requestJson(`${apiBase}/mocks`, {
    method: "GET",
    headers: {
      "X-Api-Key": apiKey,
      Accept: "application/json"
    }
  });

  const mocks = Array.isArray(payload.mocks) ? payload.mocks : [];
  const matchingMocks = mocks.filter((mock) => mock && mock.name === mockName);

  for (const mock of matchingMocks) {
    await requestJson(`${apiBase}/mocks/${encodeURIComponent(String(mock.id))}`, {
      method: "DELETE",
      headers: {
        "X-Api-Key": apiKey,
        Accept: "application/json"
      }
    });
  }
}

async function syncRuntimeEnvironmentBaseUrl(apiBase, apiKey, runtimeEnvironmentName, runtimeEnvironmentId, mockUrl) {
  let resolvedEnvironmentId = runtimeEnvironmentId;

  if (!resolvedEnvironmentId) {
    const payload = await requestJson(`${apiBase}/environments`, {
      method: "GET",
      headers: {
        "X-Api-Key": apiKey,
        Accept: "application/json"
      }
    });

    const environments = Array.isArray(payload.environments) ? payload.environments : [];
    const { entity: match, candidateNames } = resolveEntityByIdOrName(environments, "", runtimeEnvironmentName);
    if (!match?.id) {
      throw new Error(
        `Unable to resolve runtime mock environment by name candidates: ${candidateNames.join(", ") || runtimeEnvironmentName}.`,
      );
    }

    resolvedEnvironmentId = String(match.id);
  }

  const environmentPayload = await requestJson(`${apiBase}/environments/${encodeURIComponent(resolvedEnvironmentId)}`, {
    method: "GET",
    headers: {
      "X-Api-Key": apiKey,
      Accept: "application/json"
    }
  });

  const environment = environmentPayload.environment;
  if (!environment || !Array.isArray(environment.values)) {
    throw new Error(`Runtime environment payload was invalid for ${resolvedEnvironmentId}.`);
  }

  const values = environment.values;
  const baseUrlVariable = values.find((value) => value && value.key === "baseUrl");
  if (baseUrlVariable) {
    baseUrlVariable.value = mockUrl;
  } else {
    values.push({
      key: "baseUrl",
      value: mockUrl,
      type: "default",
      enabled: true
    });
  }

  await requestJson(`${apiBase}/environments/${encodeURIComponent(resolvedEnvironmentId)}`, {
    method: "PUT",
    headers: {
      "X-Api-Key": apiKey,
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      environment: {
        name: environment.name || runtimeEnvironmentName,
        values
      }
    })
  });

  writeGithubOutput("runtime_environment_id", resolvedEnvironmentId);
}

async function main() {
  const adminEnvironmentPath = path.resolve(getArgValue("--admin-env"));
  const collectionPath = path.resolve(getArgValue("--collection"));
  const apiKey = (process.env.POSTMAN_API_KEY || "").trim();
  const mode = (getArgValue("--mode", "ephemeral") || "ephemeral").trim().toLowerCase();
  const runId = (process.env.GITHUB_RUN_ID || "manual").trim();

  if (!adminEnvironmentPath || !fs.existsSync(adminEnvironmentPath)) {
    throw new Error(`Admin environment file not found: ${adminEnvironmentPath}`);
  }

  if (!collectionPath || !fs.existsSync(collectionPath)) {
    throw new Error(`Collection file not found: ${collectionPath}`);
  }

  if (!apiKey) {
    throw new Error("POSTMAN_API_KEY is required.");
  }

  const adminEnvironment = JSON.parse(fs.readFileSync(adminEnvironmentPath, "utf8"));
  const apiBase = getEnvValue(adminEnvironment, "postmanApiBaseUrl") || "https://api.getpostman.com";
  const workspaceId = getEnvValue(adminEnvironment, "workspaceId");
  const preferredPostmanId =
    getEnvValue(adminEnvironment, "mockSourceCollectionPostmanId") ||
    getEnvValue(adminEnvironment, "contractTestsCollectionPostmanId");
  const preferredName =
    getEnvValue(adminEnvironment, "mockSourceCollectionName") ||
    getEnvValue(adminEnvironment, "contractTestsCollectionName") ||
    "Board Enthusiasts API (Contract Tests)";
  const runtimeEnvironmentName =
    getEnvValue(adminEnvironment, "mockRuntimeEnvironmentName") ||
    "Board Enthusiasts - Mock";
  const runtimeEnvironmentId = getEnvValue(adminEnvironment, "mockRuntimeEnvironmentId");
  const baseMockServerName =
    getEnvValue(adminEnvironment, "mockServerName") || "Board Enthusiasts API Mock";
  const mockServerName =
    mode === "ephemeral"
      ? `${baseMockServerName} (CI ${runId})`
      : baseMockServerName;

  if (!workspaceId) {
    throw new Error(`workspaceId is missing in ${adminEnvironmentPath}`);
  }

  const headers = {
    "X-Api-Key": apiKey,
    Accept: "application/json",
    "Content-Type": "application/json"
  };

  const collectionListPayload = await requestJson(`${apiBase}/collections`, {
    method: "GET",
    headers: {
      "X-Api-Key": apiKey,
      Accept: "application/json"
    }
  });

  const collections = Array.isArray(collectionListPayload.collections) ? collectionListPayload.collections : [];
  const { entity: targetCollection, candidateNames } = resolveEntityByIdOrName(
    collections,
    preferredPostmanId,
    preferredName,
  );

  if (!targetCollection?.uid) {
    throw new Error(
      `Unable to resolve Postman collection by id="${preferredPostmanId}" name candidates="${candidateNames.join(", ")}".`,
    );
  }

  const localCollection = stripPostmanIds(JSON.parse(fs.readFileSync(collectionPath, "utf8")));
  await requestJsonWithRetry(`${apiBase}/collections/${encodeURIComponent(targetCollection.uid)}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ collection: localCollection })
  });

  if (mode === "shared") {
    await deleteMocksByName(apiBase, apiKey, mockServerName);
  }

  const createMockPayload = await requestJson(`${apiBase}/mocks?workspace=${encodeURIComponent(workspaceId)}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      mock: {
        name: mockServerName,
        collection: targetCollection.uid,
        private: false
      }
    })
  });

  const mock = createMockPayload.mock;
  if (!mock?.id || !(mock.mockUrl || mock.url)) {
    throw new Error("Postman mock creation succeeded but the response did not include an id and URL.");
  }

  const mockId = String(mock.id);
  const mockUrl = String(mock.mockUrl || mock.url);

  await syncRuntimeEnvironmentBaseUrl(apiBase, apiKey, runtimeEnvironmentName, runtimeEnvironmentId, mockUrl);

  writeGithubOutput("should_run", "true");
  writeGithubOutput("api_base", apiBase);
  writeGithubOutput("mock_id", mockId);
  writeGithubOutput("base_url", mockUrl);

  console.log(JSON.stringify({
    collectionUid: targetCollection.uid,
    mockId,
    mockUrl,
    mockServerName,
    mode
  }, null, 2));
}

export { buildNameCandidates, resolveEntityByIdOrName };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error?.stack || error);
    process.exit(1);
  });
}
