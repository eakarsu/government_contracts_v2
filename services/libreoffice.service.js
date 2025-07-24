// services/libreoffice.service.js
const { exec } = require('child_process');
const util = require('util');
const { v4: uuidv4 } = require('uuid');
const execPromise = util.promisify(exec);

class LibreOfficeSemaphore {
    constructor(maxConcurrent = 10) { // Balanced at 10 to match document worker concurrency
        this.maxConcurrent = maxConcurrent;
        this.running = 0;
        this.queue = [];
    }

    async acquire() {
        return new Promise((resolve) => {
            if (this.running < this.maxConcurrent) {
                this.running++;
                resolve();
            } else {
                this.queue.push(resolve);
            }
        });
    }

    release() {
        this.running--;
        if (this.queue.length > 0) {
            const next = this.queue.shift();
            this.running++;
            next();
        }
    }
}

class LibreOfficeService {
    constructor() {
        this.semaphore = new LibreOfficeSemaphore(10); // Match 10 document worker concurrency for optimal performance
        this.setupCleanup();
    }

    setupCleanup() {
        // Run cleanup every 5 minutes
        setInterval(() => this.cleanupProcesses(), 300000);
    }

    cleanupProcesses() {
        try {
            exec('pkill -f soffice.bin', (error) => {
                if (!error) {
                    console.log('Cleaned up stuck LibreOffice processes');
                }
            });
            
            exec('pkill -f "libreoffice"', (error) => {
                if (!error) {
                    console.log('Cleaned up stuck LibreOffice main processes');
                }
            });
        } catch (error) {
            console.error('Error cleaning up processes:', error);
        }
    }

    async convertToPdfWithRetry(inputPath, outputDir, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await this.convertToPdfSingle(inputPath, outputDir);
                return result;
            } catch (error) {
                console.error(`LibreOffice PDF conversion attempt ${attempt} failed:`, error.message);
                
                if (error.message.includes('javaldx') || 
                    error.message.includes('Java Runtime Environment') ||
                    error.message.includes('UserInstallation')) {
                    
                    if (attempt < maxRetries) {
                        const backoffDelay = 1000 * Math.pow(2, attempt - 1);
                        console.log(`Retrying LibreOffice PDF conversion in ${backoffDelay}ms... (attempt ${attempt + 1}/${maxRetries})`);
                        
                        this.cleanupProcesses();
                        await new Promise(resolve => setTimeout(resolve, backoffDelay));
                        continue;
                    }
                }
                throw error;
            }
        }
    }

    async convertToWordWithRetry(inputPath, outputDir, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await this.convertToWordSingle(inputPath, outputDir);
                return result;
            } catch (error) {
                console.error(`LibreOffice Word conversion attempt ${attempt} failed:`, error.message);
                
                if (error.message.includes('javaldx') || 
                    error.message.includes('Java Runtime Environment') ||
                    error.message.includes('UserInstallation')) {
                    
                    if (attempt < maxRetries) {
                        const backoffDelay = 1000 * Math.pow(2, attempt - 1);
                        console.log(`Retrying LibreOffice Word conversion in ${backoffDelay}ms... (attempt ${attempt + 1}/${maxRetries})`);
                        
                        this.cleanupProcesses();
                        await new Promise(resolve => setTimeout(resolve, backoffDelay));
                        continue;
                    }
                }
                throw error;
            }
        }
    }

    async convertToPdfSingle(inputPath, outputDir) {
        const uniqueId = uuidv4();
        const userInstallDir = `/tmp/libreoffice_${uniqueId}`;
        
        try {
            await execPromise(`mkdir -p "${userInstallDir}"`);
            
            const platform = process.platform;
            let libreofficePath;
            
            if (platform === 'darwin') {
                libreofficePath = '/Applications/LibreOffice.app/Contents/MacOS/soffice';
            } else if (platform === 'linux') {
                libreofficePath = 'libreoffice';
            } else {
                throw new Error(`Unsupported platform: ${platform}`);
            }

            const command = [
                `"${libreofficePath}"`,
                '--headless',
                '--convert-to', 'pdf',
                '--outdir', `"${outputDir}"`,
                `-env:UserInstallation=file://${userInstallDir}`,
                '--norestore',
                '--invisible',
                `"${inputPath}"`
            ].join(' ');

            console.log(`Converting to PDF with unique installation: ${userInstallDir}`);
            await execPromise(command, { timeout: 300000 }); // Increased to 5 minutes
            
            return { success: true, userInstallDir };
            
        } catch (error) {
            throw new Error(`LibreOffice PDF conversion failed: ${error.message}`);
        } finally {
            try {
                await execPromise(`rm -rf "${userInstallDir}"`);
            } catch (cleanupError) {
                console.error(`Failed to cleanup user installation directory: ${cleanupError.message}`);
            }
        }
    }

    async convertToWordSingle(inputPath, outputDir) {
        const uniqueId = uuidv4();
        const userInstallDir = `/tmp/libreoffice_${uniqueId}`;
        
        try {
            await execPromise(`mkdir -p "${userInstallDir}"`);
            
            const platform = process.platform;
            let libreofficePath;
            
            if (platform === 'darwin') {
                libreofficePath = '/Applications/LibreOffice.app/Contents/MacOS/soffice';
            } else if (platform === 'linux') {
                libreofficePath = 'libreoffice';
            } else {
                throw new Error(`Unsupported platform: ${platform}`);
            }

            const command = [
                `"${libreofficePath}"`,
                '--headless',
                '--convert-to', 'docx',
                '--outdir', `"${outputDir}"`,
                `-env:UserInstallation=file://${userInstallDir}`,
                '--norestore',
                '--invisible',
                `"${inputPath}"`
            ].join(' ');

            console.log(`Converting to Word with unique installation: ${userInstallDir}`);
            await execPromise(command, { timeout: 300000 }); // Increased to 5 minutes
            
            return { success: true, userInstallDir };
            
        } catch (error) {
            throw new Error(`LibreOffice Word conversion failed: ${error.message}`);
        } finally {
            try {
                await execPromise(`rm -rf "${userInstallDir}"`);
            } catch (cleanupError) {
                console.error(`Failed to cleanup user installation directory: ${cleanupError.message}`);
            }
        }
    }

    async acquireSemaphore() {
        await this.semaphore.acquire();
    }

    releaseSemaphore() {
        this.semaphore.release();
    }

    getStatus() {
        return {
            running: this.semaphore.running,
            queued: this.semaphore.queue.length,
            max_concurrent: this.semaphore.maxConcurrent
        };
    }
}

module.exports = LibreOfficeService;

