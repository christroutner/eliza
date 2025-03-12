import * as fs from "node:fs";
import { existsSync, readFileSync } from 'node:fs';
import * as net from "node:net";
import * as os from "node:os";
import path from "node:path";
import { buildProject } from "@/src/utils/build-project";
import {
	AgentRuntime,
	type Character,
	type IAgentRuntime,
	type ProjectAgent,
	logger,
	settings,
	stringToUuid
} from "@elizaos/core";
import { Command } from "commander";
import * as dotenv from "dotenv";
import { loadProject } from "../project.js";
import { AgentServer } from "../server/index.js";
import { jsonToCharacter, loadCharacterTryPath } from "../server/loader";
import { TestRunner } from "../testRunner.js";
import { promptForEnvVars } from "../utils/env-prompt.js";
import { handleError } from "../utils/handle-error";

// Helper function to check port availability
async function checkPortAvailable(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const server = net.createServer();
		server.once("error", () => {
			resolve(false);
		});
		server.once("listening", () => {
			server.close();
			resolve(true);
		});
		server.listen(port);
	});
}

// Helper function to start an agent
async function startAgent(
	character: Character,
	server: AgentServer,
	init?: (runtime: IAgentRuntime) => void,
	plugins: any[] = [],
): Promise<IAgentRuntime> {
	character.id ??= stringToUuid(character.name);

	try {
		// Manually ensure agent exists in the database before using it
		// This is necessary for test mode to prevent foreign key errors
		if (server.database) {
			try {
				// First check if the agent already exists
				const existingAgent = await server.database.getAgent(character.id).catch(() => null);
				
				if (existingAgent) {
					logger.debug(`Agent already exists in database with ID: ${character.id}`);
					// Update the agent record to match our character
					try {
						await server.database.updateAgent({
							id: character.id,
							name: `${character.name} (DB)`,
							bio: character.bio || "",
							system: character.system || "",
							enabled: true,
							updatedAt: Date.now()
						});
						logger.debug(`Updated existing agent in database: ${character.id}`);
					} catch (updateError) {
						logger.debug(`Note: Agent update failed: ${updateError instanceof Error ? updateError.message : String(updateError)}`);
					}
				} else {
					// If agent doesn't exist, create it
					logger.debug(`Creating new agent in database: ${character.name}`);
					await server.database.createAgent({
						id: character.id,
						name: `${character.name} (DB)`,
						bio: character.bio || "",
						system: character.system || "",
						enabled: true,
						createdAt: Date.now(),
						updatedAt: Date.now()
					});
					logger.debug(`Created agent in database: ${character.id}`);
				}
				
				// Verify agent exists (should exist now)
				const agent = await server.database.getAgent(character.id).catch(() => null);
				if (agent) {
					logger.debug(`Verified agent exists in database with ID: ${character.id}`);
				} else {
					// This should not happen if our create/update was successful
					logger.error(`Critical error: Agent does not exist in database after creation/update: ${character.id}`);
					throw new Error(`Agent ${character.id} does not exist in database after creation/update attempt`);
				}
			} catch (dbError) {
				// Only throw if it's a critical error not related to entity existence
				if (dbError instanceof Error && 
					!dbError.message.includes('already exists') && 
					!dbError.message.includes('foreign key constraint') &&
					!dbError.message.includes('violates unique constraint')) {
					throw dbError;
				}
				logger.debug(`Note: Database operation might have encountered a non-critical error: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
			}
		}
			
		// Filter out any undefined or null plugins
		const validPlugins = plugins.filter(plugin => plugin != null);
		
		// Log information about the plugins
		if (validPlugins.length > 0) {
			logger.debug(`Starting agent with ${validPlugins.length} plugins:`);
			validPlugins.forEach((plugin, i) => {
				logger.debug(`  Plugin ${i+1}: ${plugin.name || 'unnamed'}`);
				logger.debug(`  Plugin properties: ${Object.keys(plugin).join(', ')}`);
				logger.debug(`  Plugin init type: ${typeof plugin.init}`);
			});
		} else if (plugins.length > 0) {
			logger.warn(`Found ${plugins.length} plugins but none were valid objects`);
		}
		
		// Create runtime
		const runtime = new AgentRuntime({
			character,
			plugins: validPlugins,
		});

		// Before runtime initialization, patch the runtime object to handle entity creation
		// errors more gracefully in test mode
		const originalInitialize = runtime.initialize.bind(runtime);
		runtime.initialize = async () => {
			try {
				// Try normal initialization
				return await originalInitialize();
			} catch (err) {
				// Handle common initialization errors in test mode
				if (err instanceof Error) {
					// Check for database errors
					if (err.message.includes('foreign key constraint') || 
						err.message.includes('does not exist in database') ||
						err.message.includes('violates unique constraint')) {
						logger.warn(`Note: Ignoring initialization error in test mode: ${err.message}`);
						// We've already created the agent record, so we can consider this successful
						return;
					}
					
					// For other errors, log in detail
					logger.error(`Non-database initialization error: ${err.message}`);
					logger.error(`Stack trace: ${err.stack}`);
				}
				
				// For other errors, rethrow
				throw err;
			}
		};
		
		// Call init if provided
		if (init) {
			try {
				await init(runtime);
			} catch (initError) {
				logger.error(`Error in agent init function for ${character.name}:`, initError);
				throw initError;
			}
		}

		// start services/plugins/process knowledge
		try {
			await runtime.initialize();
		} catch (initError) {
			logger.error(`Error initializing runtime for ${character.name}:`, initError);
			
			// Additional debugging for plugin issues
			if (validPlugins.length > 0) {
				logger.debug(`Agent has ${validPlugins.length} plugins:`);
				validPlugins.forEach((plugin, index) => {
					logger.debug(`  Plugin ${index + 1}: ${plugin.name || 'unnamed'}`);
					if (plugin.init && typeof plugin.init !== 'function') {
						logger.error(`  Plugin ${plugin.name} has an init property that is not a function`);
					}
				});
			}
			
			throw initError;
		}

		// add to container
		server.registerAgent(runtime);

		// report to console
		logger.debug(`Started ${runtime.character.name} as ${runtime.agentId}`);

		return runtime;
	} catch (error) {
		logger.error(`Failed to start agent ${character.name}:`, error);
		throw error;
	}
}

/**
 * Function that runs the tests.
 */
const runAgentTests = async (options: {
	port?: number;
	plugin?: string;
	skipPlugins?: boolean;
	skipProjectTests?: boolean;
	skipBuild?: boolean;
}) => {
	// Build the project or plugin first unless skip-build is specified
	if (options && !options.skipBuild) {
		const cwd = process.cwd();
		const isPlugin = options.plugin ? true : checkIfLikelyPluginDir(cwd);
		await buildProject(cwd, isPlugin);
	}

	try {
		const runtimes: IAgentRuntime[] = [];
		const projectAgents: ProjectAgent[] = [];

		// Set up standard paths and load .env
		const homeDir = os.homedir();
		const elizaDir = path.join(homeDir, ".eliza");
		const elizaDbDir = path.join(elizaDir, "db");
		const envFilePath = path.join(elizaDir, ".env");

		logger.info("Setting up environment...");
		logger.info(`Home directory: ${homeDir}`);
		logger.info(`Eliza directory: ${elizaDir}`);
		logger.info(`Database directory: ${elizaDbDir}`);
		logger.info(`Environment file: ${envFilePath}`);

		// Create .eliza directory if it doesn't exist
		if (!fs.existsSync(elizaDir)) {
			logger.info(`Creating directory: ${elizaDir}`);
			fs.mkdirSync(elizaDir, { recursive: true });
			logger.info(`Created directory: ${elizaDir}`);
		}

		// Create db directory if it doesn't exist
		if (!fs.existsSync(elizaDbDir)) {
			logger.info(`Creating database directory: ${elizaDbDir}`);
			fs.mkdirSync(elizaDbDir, { recursive: true });
			logger.info(`Created database directory: ${elizaDbDir}`);
		}

		// Set the database directory in environment variables
		process.env.PGLITE_DATA_DIR = elizaDbDir;
		logger.info(`Using database directory: ${elizaDbDir}`);

		// Load environment variables from .eliza/.env if it exists
		if (fs.existsSync(envFilePath)) {
			logger.info(`Loading environment variables from: ${envFilePath}`);
			dotenv.config({ path: envFilePath });
			logger.info("Environment variables loaded");
		} else {
			logger.warn(`Environment file not found: ${envFilePath}`);
		}

		// Always ensure database configuration is set
		try {
			logger.info("Configuring database...");
			await promptForEnvVars("pglite");
			logger.info("Database configuration completed");
		} catch (error) {
			logger.error("Error configuring database:", error);
			if (error instanceof Error) {
				logger.error("Error details:", error.message);
				logger.error("Stack trace:", error.stack);
			}
			throw error;
		}

		// Look for PostgreSQL URL in environment variables
		const postgresUrl = process.env.POSTGRES_URL;
		logger.info(`PostgreSQL URL: ${postgresUrl ? "found" : "not found"}`);

		// Create server instance
		logger.info("Creating server instance...");
		const server = new AgentServer({
			dataDir: elizaDbDir,
			postgresUrl,
		});
		logger.info("Server instance created");

		// Wait for database initialization
		logger.info("Waiting for database initialization...");
		try {
			await new Promise<void>((resolve, reject) => {
				let initializationAttempts = 0;
				const maxAttempts = 5;
				const checkInterval = setInterval(async () => {
					try {
						// Check if the database is already initialized
						if (server.database?.isInitialized) {
							clearInterval(checkInterval);
							resolve();
							return;
						}
						
						// Try to initialize if not already initialized
						initializationAttempts++;
						try {
							await server.database?.init();
							// If we reach here without error, consider initialization successful
							clearInterval(checkInterval);
							resolve();
						} catch (initError) {
							logger.warn(`Database initialization attempt ${initializationAttempts}/${maxAttempts} failed:`, initError);
							
							// Check if we've reached the maximum attempts
							if (initializationAttempts >= maxAttempts) {
								if (server.database?.connection) {
									// If we have a connection, consider it good enough even with migration errors
									logger.warn("Max initialization attempts reached, but database connection exists. Proceeding anyway.");
									clearInterval(checkInterval);
									resolve();
								} else {
									clearInterval(checkInterval);
									reject(new Error(`Database initialization failed after ${maxAttempts} attempts`));
								}
							}
							// Otherwise, continue to next attempt
						}
					} catch (error) {
						logger.error("Error during database initialization check:", error);
						if (error instanceof Error) {
							logger.error("Error details:", error.message);
							logger.error("Stack trace:", error.stack);
						}
						clearInterval(checkInterval);
						reject(error);
					}
				}, 1000);

				// Timeout after 30 seconds
				setTimeout(() => {
					clearInterval(checkInterval);
					if (server.database?.connection) {
						// If we have a connection, consider it good enough even with initialization issues
						logger.warn("Database initialization timeout, but connection exists. Proceeding anyway.");
						resolve();
					} else {
						reject(new Error("Database initialization timed out after 30 seconds"));
					}
				}, 30000);
			});
			logger.info("Database initialized successfully");
		} catch (error) {
			logger.error("Failed to initialize database:", error);
			if (error instanceof Error) {
				logger.error("Error details:", error.message);
				logger.error("Stack trace:", error.stack);
			}
			throw error;
		}

		// Set up server properties
		logger.info("Setting up server properties...");
		server.startAgent = async (character) => {
			logger.info(`Starting agent for character ${character.name}`);
			return startAgent(character, server);
		};
		server.loadCharacterTryPath = loadCharacterTryPath;
		server.jsonToCharacter = jsonToCharacter;
		logger.info("Server properties set up");

		let serverPort = options.port || Number.parseInt(settings.SERVER_PORT || "3000");

		// Try to determine if this is a plugin directory by checking for common plugin files
		const isLikelyPluginDir = checkIfLikelyPluginDir(process.cwd());
		
		logger.info(`Checking current directory: ${process.cwd()}`);
		
		// Set environment variable to help TestRunner identify when we're testing a plugin directly
		if (isLikelyPluginDir) {
			process.env.ELIZA_TESTING_PLUGIN = 'true';
			logger.debug("Set ELIZA_TESTING_PLUGIN=true for direct plugin testing");
		}
		
		let project;
		try {
			logger.debug("Attempting to load project or plugin...");
			
			// Only try to load the project if we're in a likely plugin or project directory
			if (isLikelyPluginDir || options.plugin) {
				project = await loadProject(process.cwd());
				
				if (project.isPlugin) {
					logger.info(`Plugin loaded successfully: ${project.pluginModule?.name}`);
					logger.info(`Description: ${project.pluginModule?.description}`);
					
					// Show test information if available
					if (project.pluginModule?.tests) {
						const testSuites = Array.isArray(project.pluginModule.tests) 
							? project.pluginModule.tests 
							: [project.pluginModule.tests];
						
						logger.info(`Plugin has ${testSuites.length} test suites:`);
						testSuites.forEach((suite, i) => {
							if (suite) {
								logger.info(`  Suite ${i+1}: ${suite.name} (${suite.tests?.length || 0} tests)`);
							}
						});
					} else {
						logger.info("Plugin does not have any test suites defined");
					}
					
					logger.info("Created a test agent to run plugin tests");
				} else {
					logger.info("Project loaded successfully");
					logger.debug(`Project details: ${JSON.stringify(project, null, 2)}`);
				}
			} else {
				// Not in a plugin or project directory
				logger.warn("No Eliza project or plugin found in current directory.");
				logger.info("Tests can only run in a valid Eliza project or plugin directory.");
				logger.info("Please navigate to a project or plugin directory and try again.");
				process.exit(0);
			}
			
			if (!project || !project.agents || project.agents.length === 0) {
				throw new Error("No agents found in project configuration");
			}
			
			logger.info(`Found ${project.agents.length} agents in ${project.isPlugin ? 'plugin' : 'project'} configuration`);
		} catch (error) {
			if (isLikelyPluginDir) {
				logger.error("Error loading plugin for testing:", error);
				if (error instanceof Error && error.message.includes("No agents found in project")) {
					logger.error("This appears to be a plugin directory, but we couldn't load the plugin properly.");
					logger.error("Make sure your plugin exports a valid plugin object with name and description properties.");
					logger.error("Example plugin structure:");
					logger.error(`
export const myPlugin = {
  name: "my-plugin",
  description: "Description of my plugin",
  // other plugin properties
};

export default myPlugin;
`);
				}
			} else {
				logger.error("Error loading project:", error);
			}
			
			if (error instanceof Error) {
				logger.error("Error details:", error.message);
				logger.error("Stack trace:", error.stack);
			}
			
			// If we can't load the project/plugin, we should exit
			logger.error("Tests cannot run without a valid project or plugin. Exiting.");
			process.exit(1);
		}

		logger.info("Checking port availability...");
		while (!(await checkPortAvailable(serverPort))) {
			logger.warn(`Port ${serverPort} is in use, trying ${serverPort + 1}`);
			serverPort++;
		}
		logger.info(`Using port ${serverPort}`);

		logger.info("Starting server...");
		try {
			await server.start(serverPort);
			logger.info("Server started successfully");
		} catch (error) {
			logger.error("Error starting server:", error);
			if (error instanceof Error) {
				logger.error("Error details:", error.message);
				logger.error("Stack trace:", error.stack);
			}
			throw error;
		}

		try {
			// Start each agent in sequence
			logger.info(`Found ${project.agents.length} agents in ${project.isPlugin ? 'plugin' : 'project'}`);
			
			// Create a map to track agent IDs we've already processed
			const processedAgentIds = new Set<string>();
			
			for (const agent of project.agents) {
				try {
					logger.info(`Starting agent: ${agent.character.name}`);
					
					// Make sure each agent has a unique ID
					if (!agent.character.id) {
						agent.character.id = stringToUuid(agent.character.name);
					}
					
					// If we've already processed an agent with this ID, generate a new unique ID
					if (processedAgentIds.has(agent.character.id)) {
						logger.warn(`Agent ID ${agent.character.id} has already been used. Generating a new ID.`);
						// Generate a UUID based on the agent name plus a timestamp for uniqueness
						agent.character.id = stringToUuid(`${agent.character.name}-${Date.now()}`);
					}
					
					// Track this agent ID
					processedAgentIds.add(agent.character.id);
					
					const runtime = await startAgent(
						agent.character,
						server,
						agent.init,
						agent.plugins || [],
					);
					runtimes.push(runtime);
					projectAgents.push(agent);
					// wait 1 second between agent starts
					await new Promise((resolve) => setTimeout(resolve, 1000));
				} catch (agentError) {
					logger.error(
						`Error starting agent ${agent.character.name}:`,
						agentError,
					);
					if (agentError instanceof Error) {
						logger.error("Error details:", agentError.message);
						logger.error("Stack trace:", agentError.stack);
					}
					throw agentError;
				}
			}

			if (runtimes.length === 0) {
				throw new Error("Failed to start any agents from project");
			}

			logger.info(`Successfully started ${runtimes.length} agents from ${project.isPlugin ? 'plugin' : 'project'}`);

			// Run tests for each agent
			let totalFailed = 0;
			for (let i = 0; i < runtimes.length; i++) {
				const runtime = runtimes[i];
				const projectAgent = projectAgents[i];
				
				if (project.isPlugin) {
					logger.info(`Running tests for plugin: ${project.pluginModule?.name}`);
				} else {
					logger.info(`Running tests for agent: ${runtime.character.name}`);
				}
				
				const testRunner = new TestRunner(runtime, projectAgent);
				
				// When in a plugin directory, we're testing only the current plugin
				// so we set skipPlugins to true to skip other loaded plugins (like OpenAI)
				// but we allow the current plugin's tests to run via isDirectPluginTest detection
				const skipPlugins = project.isPlugin ? true : options.skipPlugins;
				
				const results = await testRunner.runTests({
					filter: options.plugin,
					skipPlugins: skipPlugins,
					skipProjectTests: options.skipProjectTests
				});
				totalFailed += results.failed;
			}

			// Clean up
			await server.stop();
			process.exit(totalFailed > 0 ? 1 : 0);
		} catch (error) {
			logger.error("Error running tests:", error);
			if (error instanceof Error) {
				logger.error("Error details:", error.message);
				logger.error("Stack trace:", error.stack);
			}
			await server.stop();
			throw error;
		}
	} catch (error) {
		logger.error("Error in runAgentTests:", error);
		if (error instanceof Error) {
			logger.error("Error details:", error.message);
			logger.error("Stack trace:", error.stack);
		} else {
			logger.error("Unknown error type:", typeof error);
			logger.error("Error value:", error);
			try {
				logger.error("Stringified error:", JSON.stringify(error, null, 2));
			} catch (e) {
				logger.error("Could not stringify error:", e);
			}
		}
		throw error;
	}
};

/**
 * Check if the current directory is likely a plugin directory
 */
function checkIfLikelyPluginDir(dir: string): boolean {
	// Check for package.json with elizaos plugin indicators
	const packageJsonPath = path.join(dir, 'package.json');
	if (existsSync(packageJsonPath)) {
		try {
			const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
			
			// Most direct check: eliza type field
			if (packageJson.eliza?.type === 'plugin') {
				logger.debug("Found eliza.type=plugin in package.json");
				return true;
			}
			
			// Check if the name contains 'plugin'
			if (packageJson.name?.toLowerCase().includes('plugin')) {
				logger.debug(`Package name '${packageJson.name}' contains 'plugin'`);
				return true;
			}
			
			// Check if it has eliza plugin keywords
			if (packageJson.keywords?.some((k: string) => 
					k.toLowerCase().includes('elizaos') || 
					k.toLowerCase().includes('eliza') || 
					k.toLowerCase().includes('plugin'))) {
				logger.debug("Found plugin-related keywords in package.json");
				return true;
			}
			
			// Check if this is explicitly NOT a project
			if (packageJson.eliza?.type === 'plugin' || 
				!packageJson.eliza?.type?.toLowerCase().includes('project')) {
				// Look for plugin-like exports
				if (existsSync(path.join(dir, 'src/plugin.ts')) || 
					existsSync(path.join(dir, 'src/index.ts')) && !existsSync(path.join(dir, 'src/agent.ts'))) {
					logger.debug("Found plugin-like file structure");
					return true;
				}
			}
		} catch (e) {
			logger.debug(`Error parsing package.json: ${e}`);
			// Ignore errors reading package.json
		}
	}
	
	// Check for common plugin files and directories
	const isPluginByFiles = 
		existsSync(path.join(dir, 'src/plugin.ts')) || 
		existsSync(path.join(dir, 'src/plugin.js')) ||
		existsSync(path.join(dir, 'dist/plugin.js')) ||
		(existsSync(path.join(dir, 'src/index.ts')) && !existsSync(path.join(dir, 'src/agent.ts'))) ||
		dir.toLowerCase().includes('plugin');
	
	if (isPluginByFiles) {
		logger.debug("Detected plugin directory based on file structure");
	}
	
	return isPluginByFiles;
}

// Create command that can be imported directly
export const test = new Command()
	.name("test")
	.description("Run tests for Eliza agent plugins")
	.option("-p, --port <port>", "Port to listen on", (val) =>
		Number.parseInt(val),
	)
	.option("-P, --plugin <name>", "Name of plugin to test")
	.option("--skip-plugins", "Skip plugin tests")
	.option("--skip-project-tests", "Skip project tests")
	.option("--skip-build", "Skip building before running tests")
	.action(async (options) => {
		logger.info("Starting test command...");
		logger.info("Command options:", options);
		try {
			logger.info("Running agent tests...");
			await runAgentTests(options);
		} catch (error) {
			logger.error("Error running tests:", error);
			if (error instanceof Error) {
				logger.error("Error details:", error.message);
				logger.error("Stack trace:", error.stack);
			} else {
				logger.error("Unknown error type:", typeof error);
				logger.error("Error value:", error);
				try {
					logger.error("Stringified error:", JSON.stringify(error, null, 2));
				} catch (e) {
					logger.error("Could not stringify error:", e);
				}
			}
			process.exit(1);
		}
	});

// This is the function that registers the command with the CLI
export default function registerCommand(cli: Command) {
	return cli.addCommand(test);
}