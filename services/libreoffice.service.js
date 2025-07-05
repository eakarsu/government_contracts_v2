// services/libreoffice.service.js
const { exec } = require('child_process');
const util = require('util');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const execPromise = util.promisify(exec);

class LibreOfficeSemaphore {
    constructor(maxConcurrent = 2) {
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
        this.semaphore = new LibreOfficeSemaphore(2);
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

     async convertDocumentToBase64Images(filePath, originalName) {
        const outputDir = path.join('outputs', Date.now().toString());
        
        await this.libreOfficeService.acquireSemaphore();
        
        try {
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            const fileExt = path.extname(originalName).toLowerCase();
            
            if (fileExt === '.pdf') {
                await execPromise(`pdftoppm -jpeg -r 300 "${filePath}" "${outputDir}/page"`);
            } else {
                console.log(`Starting LibreOffice conversion for: ${originalName}`);
                await this.libreOfficeService.convertToPdfWithRetry(filePath, outputDir);
                
                const files = fs.readdirSync(outputDir);
                const pdfFiles = files.filter(file => file.endsWith('.pdf'));
                
                if (pdfFiles.length === 0) {
                    throw new Error('No PDF files found after LibreOffice conversion');
                }

                const pdfPath = path.join(outputDir, pdfFiles[0]);
                console.log(`Converting PDF to images: ${pdfPath}`);
                
                await execPromise(`pdftoppm -jpeg -r 300 "${pdfPath}" "${outputDir}/page"`);
            }

            const files = fs.readdirSync(outputDir);
            const imageFiles = files.filter(file => file.match(/page-\d+\.jpg/) || file.match(/page\d+\.jpg/));
            
            imageFiles.sort((a, b) => {
                const pageA = parseInt(a.match(/\d+/)[0]);
                const pageB = parseInt(b.match(/\d+/)[0]);
                return pageA - pageB;
            });

            const images = [];
            for (const imageFile of imageFiles) {
                const imagePath = path.join(outputDir, imageFile);
                const imageData = fs.readFileSync(imagePath);
                images.push(Buffer.from(imageData).toString('base64'));
            }

            cleanupFiles([outputDir]);
            
            console.log(`Successfully converted ${originalName} to ${images.length} images`);
            return images;
            
        } catch (error) {
            cleanupFiles([outputDir]);
            throw error;
        } finally {
            this.libreOfficeService.releaseSemaphore();
        }
    }

    async cleanupFiles (filePaths)  {
        filePaths.forEach(filePath => {
                if (fs.existsSync(filePath)) {
                    try {
                        if (fs.statSync(filePath).isDirectory()) {
                            fs.rmSync(filePath, { recursive: true, force: true });
                        } else {
                            fs.unlinkSync(filePath);
                        }
                    } catch (error) {
                        console.error(`Error cleaning up ${filePath}:`, error);
                    }

                    // Clean up files with same base name but different extensions
                    try {
                        const dir = path.dirname(filePath);
                        const baseName = path.basename(filePath, path.extname(filePath));
                        
                        if (fs.existsSync(dir)) {
                            const files = fs.readdirSync(dir);
                            files.forEach(file => {
                                const fullPath = path.join(dir, file);
                                const fileBaseName = path.basename(file, path.extname(file));
                                
                                if (fileBaseName === baseName && fs.statSync(fullPath).isFile()) {
                                    try {
                                        fs.unlinkSync(fullPath);
                                        console.log(`Cleaned up related file: ${fullPath}`);
                                    } catch (error) {
                                        console.error(`Error cleaning up related file ${fullPath}:`, error);
                                    }
                                }
                            });
                        }
                    } catch (error) {
                        console.error(`Error during extended cleanup for ${filePath}:`, error);
                    }
                }
            });
        };

    async convertToPdfWithRetry(inputPath, outputDir, maxRetries = 3) {
        const fileExt = path.extname(inputPath).toLowerCase();
        if (fileExt === '.pdf') {
            return { success: true };
        }
        await this.acquireSemaphore();
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await this.convertToPdfSingle(inputPath, outputDir);

                const  allFiles = fs.readdirSync(outputDir);
                // Check if the specific input file has a PDF counterpart
                const inputBaseName = path.basename(inputPath, path.extname(inputPath));
                const hasPDFCounterpart = allFiles.some(f => 
                    f.toLowerCase().endsWith('.pdf') && 
                    path.basename(f, '.pdf') === inputBaseName
                );

                if (!hasPDFCounterpart) {
                    throw new Error('No PDF files found after LibreOffice conversion');
                }else {
                    console.log (` ${inputPath} is ssuccesfully translated to pdf`)
                }
                return result;
            } catch (error) {
                console.error(`LibreOffice conversion attempt ${attempt} failed:`, error.message);
                
                if (error.message.includes('javaldx') || 
                    error.message.includes('Java Runtime Environment') ||
                    error.message.includes('UserInstallation')) {
                    
                    if (attempt < maxRetries) {
                        const backoffDelay = 1000 * Math.pow(2, attempt - 1);
                        console.log(`Retrying LibreOffice conversion in ${backoffDelay}ms... (attempt ${attempt + 1}/${maxRetries})`);
                        
                        this.cleanupProcesses();
                        await new Promise(resolve => setTimeout(resolve, backoffDelay));
                        continue;
                    }
                }
                throw error;
            } finally {
                this.releaseSemaphore();
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

            console.log(`Converting with unique installation: ${userInstallDir}`);
            await execPromise(command, { timeout: 60000 });
            
            return { success: true, userInstallDir };
            
        } catch (error) {
            throw new Error(`LibreOffice conversion failed: ${error.message}`);
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

