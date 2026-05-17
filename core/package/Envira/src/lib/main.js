const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Main class for dotenvx environment variable management with encryption support
class DotenvX {
    constructor(options = {}) {
        // Target environment object to populate (defaults to process.env)
        this.processEnv = options.processEnv || process.env;
        // Whether to override existing environment variables
        this.overload = options.overload || options.override || false;
        // Whether to throw errors on missing files or parse failures
        this.strict = options.strict || false;
        // List of error codes to ignore during loading
        this.ignore = options.ignore || [];
        // Path to file containing encryption keys
        this.envKeysFile = options.envKeysFile || null;
        // Whether to enable operational features (default true)
        this.opsOn = options.opsOff !== true;
        // Private key for decrypting encrypted values
        this.privateKey = options.privateKey || null;
    }

    // Load environment variables from files and strings into process.env
    load(options = {}) {
        // Normalize path option to envFile array format
        if (options.path && !options.envFile) {
            options.envFile = Array.isArray(options.path) ? options.path : [options.path];
        }

        const envFiles = options.envFile || ['.env'];
        const envVaultFiles = options.envVaultFile || [];
        const envStrings = options.env || [];
        const DOTENV_KEY = options.DOTENV_KEY || process.env.DOTENV_KEY;
        const convention = options.convention || null;

        const parsedAll = {};
        const errors = [];

        // Add convention-specific files to the front of the load order
        if (convention) {
            const conventionFiles = this.getConventionFiles(convention);
            envFiles.unshift(...conventionFiles);
        }

        // Parse inline environment strings first (highest priority)
        for (const envString of envStrings) {
            const parsed = this.parseEnvString(envString);
            Object.assign(parsedAll, parsed);
        }

        // Load and parse standard .env files
        for (const envFile of envFiles) {
            const filepath = path.resolve(envFile);
            if (!fs.existsSync(filepath)) {
                if (!this.ignore.includes('MISSING_ENV_FILE')) {
                    errors.push({
                        code: 'MISSING_ENV_FILE',
                        message: `Missing env file: ${filepath}`,
                    });
                }
                continue;
            }

            const content = fs.readFileSync(filepath, 'utf8');
            const parsed = this.parse(content, {
                privateKey: this.privateKey,
                overload: this.overload,
            });
            Object.assign(parsedAll, parsed);
        }

        // Load and parse encrypted .env.vault files
        for (const envVaultFile of envVaultFiles) {
            const filepath = path.resolve(envVaultFile);
            if (!fs.existsSync(filepath)) {
                if (!this.ignore.includes('MISSING_ENV_VAULT_FILE')) {
                    errors.push({
                        code: 'MISSING_ENV_VAULT_FILE',
                        message: `Missing env vault file: ${filepath}`,
                    });
                }
                continue;
            }

            const content = fs.readFileSync(filepath, 'utf8');
            const parsed = this.parseVault(content, DOTENV_KEY);
            Object.assign(parsedAll, parsed);
        }

        // Apply parsed variables to target environment object
        for (const [key, value] of Object.entries(parsedAll)) {
            if (!(key in this.processEnv) || this.overload) {
                this.processEnv[key] = value;
            }
        }

        // Throw first error if strict mode is enabled
        if (this.strict && errors.length > 0) {
            throw errors[0];
        }

        return { parsed: parsedAll, errors };
    }

    // Parse raw .env file content into key-value pairs with decryption support
    parse(src, options = {}) {
        const privateKey = options.privateKey || this.privateKey;
        const overload = options.overload || this.overload;
        const parsed = {};

        if (!src || typeof src !== 'string') {
            return parsed;
        }

        const lines = src.split(/\r?\n/);
        for (const line of lines) {
            // Skip empty lines and comments
            if (line.trim() === '' || line.trim().startsWith('#')) {
                continue;
            }

            // Match KEY=VALUE pattern
            const match = line.match(/^([^=]+)=(.*)$/);
            if (!match) {
                continue;
            }

            const key = match[1].trim();
            let value = match[2].trim();

            // Remove inline comments
            value = value.split('#')[0].trim();

            // Strip surrounding quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }

            // Decrypt value if encrypted and private key is available
            if (value.startsWith('encrypted:')) {
                if (privateKey) {
                    value = this.decrypt(value, privateKey);
                }
            }

            // Apply overload logic for existing environment variables
            if (!(key in this.processEnv) || overload) {
                parsed[key] = value;
            } else {
                parsed[key] = this.processEnv[key];
            }
        }

        return parsed;
    }

    // Parse encrypted .env.vault file content using DOTENV_KEY
    parseVault(src, DOTENV_KEY) {
        const parsed = {};

        if (!src || typeof src !== 'string') {
            return parsed;
        }

        // Vault parsing requires a valid DOTENV_KEY
        if (!DOTENV_KEY) {
            return parsed;
        }

        const lines = src.split(/\r?\n/);
        for (const line of lines) {
            if (line.trim() === '' || line.trim().startsWith('#')) {
                continue;
            }

            const match = line.match(/^([^=]+)=(.*)$/);
            if (!match) {
                continue;
            }

            const key = match[1].trim();
            let value = match[2].trim();

            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }

            // Decrypt vault values using the provided DOTENV_KEY
            if (value.startsWith('encrypted:')) {
                value = this.decrypt(value, DOTENV_KEY);
            }

            parsed[key] = value;
        }

        return parsed;
    }

    // Parse a single KEY=VALUE environment string
    parseEnvString(envString) {
        const parsed = {};
        const match = envString.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            parsed[key] = value;
        }
        return parsed;
    }

    // Retrieve environment variable value with flexible loading options
    get(key, options = {}) {
        if (options.path && !options.envFile) {
            options.envFile = Array.isArray(options.path) ? options.path : [options.path];
        }

        const envFiles = options.envFile || ['.env'];
        const envStrings = options.env || [];
        const DOTENV_KEY = options.DOTENV_KEY || process.env.DOTENV_KEY;
        const includeProcessEnv = options.all || false;

        const parsedAll = {};

        // Parse inline strings first
        for (const envString of envStrings) {
            const parsed = this.parseEnvString(envString);
            Object.assign(parsedAll, parsed);
        }

        // Parse .env files
        for (const envFile of envFiles) {
            const filepath = path.resolve(envFile);
            if (!fs.existsSync(filepath)) {
                continue;
            }

            const content = fs.readFileSync(filepath, 'utf8');
            const parsed = this.parse(content, {
                privateKey: this.privateKey,
                overload: this.overload,
            });
            Object.assign(parsedAll, parsed);
        }

        // Optionally merge with process.env
        if (includeProcessEnv) {
            Object.assign(parsedAll, process.env);
        }

        // Return single value or full object based on key parameter
        if (key) {
            return parsedAll[key];
        }

        // Format output for shell or eval usage if requested
        if (options.format === 'eval') {
            let inline = '';
            for (const [k, value] of Object.entries(parsedAll)) {
                inline += `${k}=${this.escape(value)}\n`;
            }
            return inline.trim();
        } else if (options.format === 'shell') {
            let inline = '';
            for (const [k, value] of Object.entries(parsedAll)) {
                inline += `${k}=${value} `;
            }
            return inline.trim();
        }

        return parsedAll;
    }

    // Set or update an environment variable in one or more .env files
    set(key, value, options = {}) {
        if (options.path && !options.envFile) {
            options.envFile = Array.isArray(options.path) ? options.path : [options.path];
        }

        const envFiles = options.envFile || ['.env'];
        const shouldEncrypt = options.plain ? false : options.encrypt !== false;
        const envKeysFile = options.envKeysFile || '.env.keys';

        const results = {
            processedEnvs: [],
            changedFilepaths: [],
            unchangedFilepaths: [],
        };

        for (const envFile of envFiles) {
            const filepath = path.resolve(envFile);
            let content = '';

            if (fs.existsSync(filepath)) {
                content = fs.readFileSync(filepath, 'utf8');
            }

            let newValue = value;
            let privateKeyAdded = false;
            let privateKeyName = null;
            let privateKeyValue = null;

            // Encrypt value if encryption is enabled
            if (shouldEncrypt) {
                const { encrypted, privateKey: newKey, keyName } = this.encrypt(value);
                newValue = encrypted;
                // Save new private key to keys file if it doesn't exist
                if (newKey && !fs.existsSync(envKeysFile)) {
                    privateKeyAdded = true;
                    privateKeyName = keyName;
                    privateKeyValue = newKey;
                    const keysContent = `${keyName}=${newKey}\n`;
                    fs.writeFileSync(envKeysFile, keysContent, 'utf8');
                }
            }

            // Update or append the key-value pair in the file
            const lines = content.split(/\r?\n/);
            let found = false;
            const newLines = [];

            for (const line of lines) {
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match && match[1].trim() === key) {
                    newLines.push(`${key}=${newValue}`);
                    found = true;
                } else {
                    newLines.push(line);
                }
            }

            // Append if key was not found
            if (!found) {
                if (content && !content.endsWith('\n')) {
                    newLines.push('');
                }
                newLines.push(`${key}=${newValue}`);
            }

            const newContent = newLines.join('\n');
            fs.writeFileSync(filepath, newContent, 'utf8');
            results.changedFilepaths.push(filepath);

            results.processedEnvs.push({
                envFilepath: filepath,
                filepath,
                key,
                value: newValue,
                error: null,
                privateKeyAdded,
                privateKeyName,
                privateKey: privateKeyValue,
                envKeysFilepath: path.resolve(envKeysFile),
            });
        }

        return results;
    }
    encrypt(value, privateKey = null) {
        const algorithm = 'aes-256-gcm';
        const iv = crypto.randomBytes(16);
        const key = privateKey || crypto.randomBytes(32);
        const cipher = crypto.createCipheriv(algorithm, key, iv);

        let encrypted = cipher.update(value, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag().toString('hex');
        const keyName = `DOTENV_KEY_${Date.now()}`;

        return {
            encrypted: `encrypted:${encrypted}.${authTag}.${iv.toString('hex')}`,
            privateKey: key.toString('hex'),
            keyName,
        };
    }
    decrypt(encryptedValue, privateKey) {
        if (!encryptedValue.startsWith('encrypted:')) {
            return encryptedValue;
        }

        const parts = encryptedValue.slice(10).split('.');
        if (parts.length !== 3) {
            return encryptedValue;
        }

        const [encrypted, authTag, iv] = parts;
        const algorithm = 'aes-256-gcm';
        const key = Buffer.from(privateKey, 'hex');
        const ivBuffer = Buffer.from(iv, 'hex');
        const authTagBuffer = Buffer.from(authTag, 'hex');

        const decipher = crypto.createDecipheriv(algorithm, key, ivBuffer);
        decipher.setAuthTag(authTagBuffer);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    // Generate or retrieve keypairs for encryption management
    keypair(envFile, envKeysFile = null) {
        const filepath = path.resolve(envFile || '.env');
        const keysFilepath = path.resolve(envKeysFile || '.env.keys');

        const keypairs = {};

        // Load existing keys from keys file
        if (fs.existsSync(keysFilepath)) {
            const content = fs.readFileSync(keysFilepath, 'utf8');
            const parsed = this.parseEnvStringContent(content);
            for (const [key, value] of Object.entries(parsed)) {
                if (key.startsWith('DOTENV_KEY_')) {
                    keypairs[key] = value;
                }
            }
        }

        // Generate new keypair
        const newKey = crypto.randomBytes(32).toString('hex');
        const newKeyName = `DOTENV_KEY_${Date.now()}`;
        keypairs[newKeyName] = newKey;

        return keypairs;
    }

    // Parse key-value content from a string (helper for keys file)
    parseEnvStringContent(content) {
        const parsed = {};
        const lines = content.split(/\r?\n/);
        for (const line of lines) {
            if (line.trim() === '' || line.trim().startsWith('#')) {
                continue;
            }
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                let value = match[2].trim();
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                parsed[key] = value;
            }
        }
        return parsed;
    }

    // List environment files matching a pattern in a directory
    ls(directory = '.', envFile = '.env*', excludeEnvFile = []) {
        const dir = path.resolve(directory);
        const files = [];

        if (!fs.existsSync(dir)) {
            return files;
        }

        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isFile()) {
                const name = entry.name;
                if (this.matchPattern(name, envFile) && !this.isExcluded(name, excludeEnvFile)) {
                    files.push({
                        name,
                        path: path.join(dir, name),
                        size: fs.statSync(path.join(dir, name)).size,
                    });
                }
            }
        }

        return files;
    }

    // Check if a filename matches the given pattern
    matchPattern(name, pattern) {
        if (pattern === '.env*') {
            return name.startsWith('.env');
        }
        return name === pattern;
    }

    // Check if a filename should be excluded from results
    isExcluded(name, excludeEnvFile) {
        for (const exclude of excludeEnvFile) {
            if (name === exclude || name.includes(exclude)) {
                return true;
            }
        }
        return false;
    }

    // Generate a .env.example file with keys but empty values
    genexample(directory = '.', envFile = '.env') {
        const dir = path.resolve(directory);
        const examplePath = path.join(dir, '.env.example');
        const envPath = path.resolve(envFile);

        if (!fs.existsSync(envPath)) {
            return { created: false, path: examplePath };
        }

        const content = fs.readFileSync(envPath, 'utf8');
        const lines = content.split(/\r?\n/);
        const exampleLines = [];

        for (const line of lines) {
            if (line.trim() === '' || line.trim().startsWith('#')) {
                exampleLines.push(line);
                continue;
            }

            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                exampleLines.push(`${key}=`);
            }
        }

        fs.writeFileSync(examplePath, exampleLines.join('\n'), 'utf8');

        return { created: true, path: examplePath };
    }

    // Get convention-specific env file lists for framework support
    getConventionFiles(convention) {
        const conventions = {
            nextjs: ['.env.local', '.env.development.local', '.env.development'],
            flow: ['.env.flow', '.env.local'],
        };
        return conventions[convention] || [];
    }

    // Escape single quotes for safe shell/eval output
    escape(value) {
        if (!value) return value;
        return value.replace(/'/g, "'\\''");
    }

    // Legacy compatibility method - alias for load()
    config(options = {}) {
        if (options.path && !options.envFile) {
            options.envFile = Array.isArray(options.path) ? options.path : [options.path];
        }

        const result = this.load(options);
        return { parsed: result.parsed, error: result.errors[0] || null };
    }

    // Rotate encryption keys for all encrypted values in env files
    rotate(options = {}) {
        if (options.path && !options.envFile) {
            options.envFile = Array.isArray(options.path) ? options.path : [options.path];
        }

        const envFiles = options.envFile || ['.env'];
        const envKeysFile = options.envKeysFile || '.env.keys';
        const excludeKeys = options.excludeKey || [];

        const results = {
            rotated: [],
            errors: [],
        };

        // Generate new master key for rotation
        const newKey = crypto.randomBytes(32).toString('hex');
        const newKeyName = `DOTENV_KEY_${Date.now()}`;

        for (const envFile of envFiles) {
            const filepath = path.resolve(envFile);
            if (!fs.existsSync(filepath)) {
                continue;
            }

            let content = fs.readFileSync(filepath, 'utf8');
            const lines = content.split(/\r?\n/);
            const newLines = [];

            for (const line of lines) {
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    let value = match[2].trim();
                    if (value.startsWith('encrypted:') && !excludeKeys.includes(key)) {
                        const decrypted = this.decrypt(value, this.privateKey || newKey);
                        const { encrypted } = this.encrypt(decrypted, newKey);
                        value = encrypted;
                    }

                    newLines.push(`${key}=${value}`);
                } else {
                    newLines.push(line);
                }
            }

            fs.writeFileSync(filepath, newLines.join('\n'), 'utf8');
            results.rotated.push(filepath);
        }
        if (!fs.existsSync(envKeysFile)) {
            fs.writeFileSync(envKeysFile, `${newKeyName}=${newKey}\n`, 'utf8');
        } else {
            let keysContent = fs.readFileSync(envKeysFile, 'utf8');
            keysContent += `${newKeyName}=${newKey}\n`;
            fs.writeFileSync(envKeysFile, keysContent, 'utf8');
        }

        return results;
    }
}

// Factory function to create a new DotenvX instance
function createDotenvX(options) {
    return new DotenvX(options);
}

// Convenience wrapper for config() method
function config(options) {
    return new DotenvX(options).config(options);
}

// Convenience wrapper for load() method
function load(options) {
    return new DotenvX(options).load(options);
}

// Convenience wrapper for parse() method
function parse(src, options) {
    return new DotenvX(options).parse(src, options);
}

// Convenience wrapper for get() method
function get(key, options) {
    return new DotenvX(options).get(key, options);
}

// Convenience wrapper for set() method
function set(key, value, options) {
    return new DotenvX(options).set(key, value, options);
}

// Convenience wrapper for encrypt() method
function encrypt(value, privateKey) {
    return new DotenvX({ privateKey }).encrypt(value, privateKey);
}

// Convenience wrapper for decrypt() method
function decrypt(encryptedValue, privateKey) {
    return new DotenvX({ privateKey }).decrypt(encryptedValue, privateKey);
}

// Convenience wrapper for keypair() method
function keypair(envFile, envKeysFile) {
    return new DotenvX().keypair(envFile, envKeysFile);
}

// Convenience wrapper for ls() method
function ls(directory, envFile, excludeEnvFile) {
    return new DotenvX().ls(directory, envFile, excludeEnvFile);
}

// Convenience wrapper for genexample() method
function genexample(directory, envFile) {
    return new DotenvX().genexample(directory, envFile);
}

// Convenience wrapper for rotate() method
function rotate(options) {
    return new DotenvX(options).rotate(options);
}

// Export class and all convenience functions
module.exports = {
    DotenvX,
    createDotenvX,
    config,
    load,
    parse,
    get,
    set,
    encrypt,
    decrypt,
    keypair,
    ls,
    genexample,
    rotate,
};
