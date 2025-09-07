const core = require('@actions/core');
const exec = require('@actions/exec');
const github = require('@actions/github');

const setupGit = async () => {
  await exec.exec(`git config --global user.name "gh-automation"`);
  await exec.exec(`git config --global user.mail "gh-automation@gmail.com"`);
};

const validateBranchName = ({ branchName }) => /^[a-zA-Z0-9_\-\.\/]+$/.test(branchName);
const validateDirectoryName = ({ dirName }) => /^[a-zA-Z0-9_\-\/]+$/.test(dirName);

const setupLogger = ({ debug, prefix } = { debug: false, prefix: ''}) => ({
  debug: (message) => {

  },
  error: (message) => {
    core.error(`${prefix}${prefix ? ' : ' :}`)
  }
})

async function run() {
  const baseBranch = core.getInput('base-branch', { required: true });
  //const targetBranch = core.getInput('target-branch', { required: true });
  const headBranch = core.getInput('head-branch',{ required: true });
  const ghToken = core.getInput('gh-token', { required: true });
  const workingDir = core.getInput('working-directory', { required: true });
  const debug = core.getBooleanInput('debug');

  const commonExecOpts = {
    cwd: workingDir
  }
  core.setSecret(ghToken);

  if (!validateBranchName({ branchName: baseBranch })) {
    core.setFailed('Invalid base-branch name. Branch names should include only characters, numbers, hyphens, underscores, dots, and forward slashes')
    return;
  }

  if (!validateBranchName({ branchName: headBranch })) {
    core.setFailed('Invalid head-branch name. Branch names should include only characters, numbers, hyphens, underscores, dots, and forward slashes')
    return;
  }

  if (!validateDirectoryName({ dirName: workingDir })) {
    core.setFailed('Invalid working-directory name. Directory names should include only characters, numbers, hyphens, underscores, dots, and forward slashes')
    return;
  }
  
  core.info(`[js-depedency-update]: base branch is ${baseBranch}`);
  core.info(`[js-depedency-update]: head branch is ${headBranch}`);
  core.info(`[js-depedency-update]: working directory is ${workingDir}`);

  await exec.exec('npm update', [], {
    ...commonExecOpts,
  });

  const gitStatus = await exec.getExecOutput('git status -s package*.json', [], {
    ...commonExecOpts,
  })

  if (gitStatus.stdout.length > 0) {
    core.info('[js-depedency-update] : updates available!');
    await setupGit();
    await exec.exec(`git checkout -b ${headBranch}`, [], {
      ...commonExecOpts,
    });
    await exec.exec(`git add package.json package-lock.json`, [], {
      ...commonExecOpts,
    });
    await exec.exec(`git commit -m "chore: update dependencies"`, [], {
      ...commonExecOpts,
    });
    await exec.exec(`git push -u origin ${headBranch} --force`, [], {
      ...commonExecOpts,
    });
    
    const octokit = github.getOctokit(ghToken);

    try {
      await octokit.rest.pulls.create({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      title: `Update NPM dependencies`,
      body: `This pull request updates npm packages`,
      base: baseBranch,
      head: headBranch
    });
    } catch (e) {
      core.error('[js-depedency-update]  Something went wrong while creating the PR. Check logs below.')
      core.setFailed(e.message);
      core.error(e);
    }
     
  }else{
    core.info('[js-depedency-update] : no updates at this point in time.');
  }
  core.info('I am a custom JS action');
}
 
run();