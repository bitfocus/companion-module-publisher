// #!/usr/bin/env zx

// silence logging output
$.verbose = false

// collect input info
const moduleName = argv._[1]
const tagName = argv._[2]
const authToken = process.env.GITHUB_TOKEN

// hardcoded repository info
const owner = 'bitfocus'
const repo = 'companion-module-publisher'

if (!moduleName || !tagName || !authToken) {
	console.error(`Missing required arguments`)
	process.exit(1)
}

// track how long we have been waiting
const startTime = Date.now()
const maxWait = 30 * 1000

const checkedRuns = new Set()
let workflowRunId = null

while (Date.now() < startTime + maxWait && !workflowRunId) {
    // get list of jobs
    const runList = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=10`, {
        headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `token ${authToken}`
        }
    })
    if (!runList.ok) {
        console.error(`Workflow poll failed`, runList.statusText)
        process.exit(1)
    }

    const runListJson = await runList.json()
    if (runListJson.workflow_runs) {
        // iterate over the workflows
        for (const run of runListJson.workflow_runs) {
            if (!checkedRuns.has(run.id)) {
                const runUrl = run.jobs_url

                // poll job info
                const jobInfo = await fetch(runUrl, {
                    headers: {
                        'Accept': 'application/vnd.github.v3+json',
                        'Authorization': `token ${authToken}`
                    }
                })
                if (!jobInfo.ok) {
                    console.error(`Workflow poll failed`)
                    process.exit(1)
                }

                const jobInfoJson = await jobInfo.json()

                // ensure jobs have populated
                if (jobInfoJson.jobs && jobInfoJson.jobs.length > 0) {
                    // assume the first job
                    const job = jobInfoJson.jobs[0]

                    // wait for steps to populate
                    if (job.steps && job.steps.length >= 2) {
                        // fetch the job, will be just after 'Set up job'
                        const idStepName = job.steps[1].name

                        if (idStepName === `${moduleName}@${tagName}`) {
                            // we found it!
                            workflowRunId = job.run_id
                            break
                        }

                        checkedRuns.add(run.id)
                    }
                    
                }
            }
        }
    }

    // wait and try again
    await sleep (5000)
}

if (!workflowRunId) {
    console.error(`Failed to find workflow id. Please check on the status manually at https://github.com/bitfocus/companion-module-publisher/actions`)
    process.exit(1)
}

// output the id
console.log(`Found run id: ${workflowRunId}`)
await fs.writeFile('./RUN_ID', workflowRunId.toString())
