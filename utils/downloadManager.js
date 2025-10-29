const EventEmitter = require('events');

class DownloadManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.maxConcurrentDownloads = options.maxConcurrentDownloads || 5;
    this.maxDownloadSpeedMbps = options.maxDownloadSpeedMbps || null;
    this.queue = [];
    this.activeDownloads = new Map();
  }

  async addToQueue(downloadJob) {
    this.queue.push(downloadJob);
    this.emit('queued', { 
      jobId: downloadJob.jobId,
      queuePosition: this.queue.length 
    });
    
    await this.processQueue();
  }

  async processQueue() {
    if (this.activeDownloads.size >= this.maxConcurrentDownloads) {
      return;
    }

    const job = this.queue.shift();
    if (!job) {
      return;
    }

    this.activeDownloads.set(job.jobId, job);
    this.emit('started', { 
      jobId: job.jobId,
      activeCount: this.activeDownloads.size,
      queueLength: this.queue.length
    });

    try {
      await job.execute();
      this.activeDownloads.delete(job.jobId);
      this.emit('completed', { jobId: job.jobId });
    } catch (error) {
      this.activeDownloads.delete(job.jobId);
      this.emit('failed', { jobId: job.jobId, error: error.message });
    }

    await this.processQueue();
  }

  getQueueStatus() {
    return {
      activeDownloads: this.activeDownloads.size,
      queuedDownloads: this.queue.length,
      maxConcurrent: this.maxConcurrentDownloads,
      activeJobs: Array.from(this.activeDownloads.keys())
    };
  }

  isJobActive(jobId) {
    return this.activeDownloads.has(jobId);
  }

  getDownloadSpeedArgs() {
    if (!this.maxDownloadSpeedMbps) {
      return [];
    }

    const bytesPerSecond = this.maxDownloadSpeedMbps * 1024 * 1024 / 8;
    return ['--limit-rate', `${Math.floor(bytesPerSecond)}`];
  }
}

const downloadManager = new DownloadManager({
  maxConcurrentDownloads: parseInt(process.env.MAX_CONCURRENT_DOWNLOADS) || 5,
  maxDownloadSpeedMbps: process.env.MAX_DOWNLOAD_SPEED_MBPS ? parseFloat(process.env.MAX_DOWNLOAD_SPEED_MBPS) : null
});

module.exports = { downloadManager, DownloadManager };
