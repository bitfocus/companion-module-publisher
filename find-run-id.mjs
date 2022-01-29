// #!/usr/bin/env zx

const moduleName = argv._[1]
const tagName = argv._[2]
const authToken = process.env.GITHUB_TOKEN

const owner = 'bitfocus'
const repo = 'companion-module-publisher'

if (!moduleName || !tagName || !authToken) {
	console.error(`Missing required arguments`)
	process.exit(1)
}


const startTime = Date.now()
const maxWait = 30 * 1000

const checkedRuns = new Set()

let workflowRunId = null

while (Date.now() < startTime + maxWait && !workflowRunId) {
    const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=10`, {
        headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `token ${authToken}`
        }
    })
    if (!resp.ok) {
        console.error(`Workflow poll failed`, resp.statusText)
        process.exit(1)
    }

    const respJson = await resp.json()
    // console.log(respJson)

    if (respJson.workflow_runs) {
        for (const run of respJson.workflow_runs) {
            if (!checkedRuns.has(run.id)) {
                const runUrl = run.jobs_url

                const resp2 = await fetch(runUrl, {
                    headers: {
                        'Accept': 'application/vnd.github.v3+json',
                        'Authorization': `token ${authToken}`
                    }
                })
                if (!resp2.ok) {
                    console.error(`Workflow poll failed`)
                    process.exit(1)
                }

                const resp2Json = await resp2.json()
                // console.log(resp2Json)

                // ensure jobs have populated
                if (resp2Json.jobs && resp2Json.jobs.length > 0) {
                    // assume the first job
                    const job = resp2Json.jobs[0]

                    // wait for steps to populate
                    if (job.steps && job.steps.length >= 2) {
                        // fetch the job, will be just after 'Set up job'
                        const idStepName = job.steps[1].name

                        if (idStepName === `${moduleName}@${tagName}`) {
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
    console.error(`Failed to find workflow id`)
    process.exit(1)
}
console.log(`Found run id: ${workflowRunId}`)
await fs.writeFile('./RUN_ID', workflowRunId.toString())
