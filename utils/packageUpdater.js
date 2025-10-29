const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function checkYtDlpVersion() {
  try {
    const { stdout } = await execAsync('yt-dlp --version');
    return stdout.trim();
  } catch (error) {
    throw new Error('Failed to check yt-dlp version: ' + error.message);
  }
}

async function updateYtDlp() {
  try {
    console.log('Updating yt-dlp...');
    const { stdout, stderr } = await execAsync('python3 -m pip install --upgrade yt-dlp');
    console.log('yt-dlp update output:', stdout);
    if (stderr) console.log('yt-dlp update stderr:', stderr);
    
    const newVersion = await checkYtDlpVersion();
    return {
      success: true,
      version: newVersion,
      message: 'yt-dlp updated successfully'
    };
  } catch (error) {
    console.error('Failed to update yt-dlp:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function checkNodePackageUpdates() {
  try {
    const { stdout } = await execAsync('npm outdated --json');
    return JSON.parse(stdout || '{}');
  } catch (error) {
    if (error.stdout) {
      return JSON.parse(error.stdout || '{}');
    }
    return {};
  }
}

async function updateNodePackages() {
  try {
    console.log('Updating Node.js packages...');
    const { stdout } = await execAsync('npm update');
    console.log('npm update output:', stdout);
    return {
      success: true,
      message: 'Node.js packages updated successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function getSystemInfo() {
  try {
    const ytdlpVersion = await checkYtDlpVersion();
    const packageUpdates = await checkNodePackageUpdates();
    
    return {
      ytdlp: {
        version: ytdlpVersion,
        updatesAvailable: Object.keys(packageUpdates).length > 0
      },
      packages: packageUpdates,
      nodeVersion: process.version,
      platform: process.platform,
      uptime: process.uptime()
    };
  } catch (error) {
    console.error('Error getting system info:', error);
    return {
      error: error.message
    };
  }
}

module.exports = {
  checkYtDlpVersion,
  updateYtDlp,
  checkNodePackageUpdates,
  updateNodePackages,
  getSystemInfo
};
