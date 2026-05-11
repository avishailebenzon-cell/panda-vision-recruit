import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import cron from 'npm:cron@3.1.0';

const base44ServiceRole = {
  async invoke(functionName, args) {
    const response = await fetch(`/api/functions/${functionName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    });
    return response.json();
  }
};

// Job definitions with cron expressions (timezone: Asia/Jerusalem)
const jobs = [
  {
    name: 'Email CV Scanner',
    cronExpression: '*/5 * * * *', // Every 5 minutes
    functionName: 'emailCvScanner',
    enabled: true
  },
  {
    name: 'Chafshanim Every Hour',
    cronExpression: '0 * * * *', // Every hour
    functionName: 'runChafshanim',
    enabled: true
  },
  {
    name: 'Agent Health Monitor',
    cronExpression: '0 */3 * * *', // Every 3 hours
    functionName: 'monitorAgentHealth',
    enabled: true
  },
  {
    name: 'Critical Automations Monitor',
    cronExpression: '0 * * * *', // Every hour
    functionName: 'monitorCriticalAutomations',
    enabled: true
  },
  {
    name: 'Scheduled Master Process',
    cronExpression: '0 2 * * *', // 2 AM daily
    functionName: 'scheduledMasterProcess',
    enabled: true
  },
  {
    name: 'Number Assignment',
    cronExpression: '0 3 * * *', // 3 AM daily
    functionName: 'scheduledNumberAssignment',
    enabled: true
  },
  {
    name: 'Hila Candidates Process',
    cronExpression: '0 4 * * *', // 4 AM daily
    functionName: 'scheduledHilaCandidatesProcess',
    enabled: true
  },
  {
    name: 'Rotem Process',
    cronExpression: '0 5 * * *', // 5 AM daily
    functionName: 'scheduledRotemProcess',
    enabled: true
  },
  {
    name: 'Elad Sending Process',
    cronExpression: '0 6 * * *', // 6 AM daily
    functionName: 'scheduledEladSendingProcess',
    enabled: true
  },
  {
    name: 'Hila Process',
    cronExpression: '0 7 * * *', // 7 AM daily
    functionName: 'scheduledHilaProcess',
    enabled: true
  }
];

const activeJobs = new Map();

function startAllJobs() {
  jobs.forEach(job => {
    if (job.enabled) {
      try {
        const task = cron.schedule(job.cronExpression, async () => {
          console.log(`[CRON] Executing: ${job.name} (${job.functionName})`);
          try {
            await base44ServiceRole.invoke(job.functionName, {});
            console.log(`[CRON] ✓ Success: ${job.name}`);
          } catch (error) {
            console.error(`[CRON] ✗ Failed: ${job.name}`, error);
          }
        }, { timezone: 'Asia/Jerusalem' });
        
        activeJobs.set(job.name, task);
        console.log(`[CRON] Scheduled: ${job.name} (${job.cronExpression})`);
      } catch (error) {
        console.error(`[CRON] Failed to schedule ${job.name}:`, error);
      }
    }
  });
  console.log(`[CRON] Total jobs scheduled: ${activeJobs.size}`);
}

function stopAllJobs() {
  activeJobs.forEach((task, name) => {
    task.stop();
    console.log(`[CRON] Stopped: ${name}`);
  });
  activeJobs.clear();
}

// HTTP endpoint to manage jobs
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  if (action === 'start') {
    startAllJobs();
    return Response.json({ status: 'Cron jobs started', count: activeJobs.size });
  }

  if (action === 'stop') {
    stopAllJobs();
    return Response.json({ status: 'Cron jobs stopped' });
  }

  if (action === 'status') {
    return Response.json({
      status: 'Cron scheduler running',
      jobs: Array.from(activeJobs.keys()),
      count: activeJobs.size
    });
  }

  // Default: start jobs on initialization
  if (activeJobs.size === 0) {
    startAllJobs();
  }

  return Response.json({ status: 'Cron scheduler initialized', count: activeJobs.size });
});