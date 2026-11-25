pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    triggers {
        pollSCM('H/5 * * * *')
    }

    environment {
        DEPLOY_REGION = "${env.AWS_REGION ?: ''}"
        DEPLOY_ACCOUNT_ID = "${env.AWS_ACCOUNT_ID ?: ''}"
        ECR_REPOSITORY = "${env.ECR_REPOSITORY_NAME ?: 'ai-devops-app'}"
        EC2_DEPLOY_HOST = "${env.EC2_HOST ?: ''}"
        EC2_DEPLOY_USER = "${env.EC2_USER ?: ''}"
        EC2_DEPLOY_PATH = "${env.EC2_DEPLOY_PATH ?: '/opt/ai-devops-monitoring'}"
        SSH_CREDENTIAL_ID = "${env.EC2_SSH_CREDENTIALS_ID ?: 'ec2-deploy-key'}"
        DASHBOARD_BASE_URL = "${env.DASHBOARD_BASE_URL ?: ''}"
        DASHBOARD_TOKEN_CREDENTIAL_ID = "${env.DASHBOARD_TOKEN_CREDENTIAL_ID ?: 'jenkins-dashboard-token'}"
        STAGE_CHECKOUT = 'SKIPPED'
        STAGE_VALIDATE_AGENT = 'SKIPPED'
        STAGE_TEST = 'SKIPPED'
        STAGE_BUILD_IMAGES = 'SKIPPED'
        STAGE_VALIDATE_DEPLOY = 'SKIPPED'
        STAGE_PUSH_IMAGES = 'SKIPPED'
        STAGE_DEPLOY = 'SKIPPED'
        STAGE_HEALTH_CHECK = 'SKIPPED'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.IMAGE_TAG = "${env.BUILD_NUMBER}-${sh(
                        script: 'git rev-parse --short=12 HEAD',
                        returnStdout: true
                    ).trim()}"
                }
            }
            post {
                success { script { env.STAGE_CHECKOUT = 'SUCCESS' } }
                failure { script { env.STAGE_CHECKOUT = 'FAILED' } }
                aborted { script { env.STAGE_CHECKOUT = 'ABORTED' } }
            }
        }

        stage('Validate build agent') {
            steps {
                sh '''
                    set -eu
                    [ "$(uname -s)" = "Linux" ] || {
                        echo "This pipeline requires a Linux Jenkins agent."
                        exit 1
                    }
                    command -v python3 >/dev/null
                    command -v docker >/dev/null
                    docker info >/dev/null
                '''
            }
            post {
                success { script { env.STAGE_VALIDATE_AGENT = 'SUCCESS' } }
                failure { script { env.STAGE_VALIDATE_AGENT = 'FAILED' } }
                aborted { script { env.STAGE_VALIDATE_AGENT = 'ABORTED' } }
            }
        }

        stage('Test') {
            steps {
                sh '''
                    set -eu
                    python3 -m venv .ci-venv
                    . .ci-venv/bin/activate
                    python -m pip install --upgrade pip
                    python -m pip install -r requirements.txt
                    python -m pytest tests/ -v
                '''
            }
            post {
                success { script { env.STAGE_TEST = 'SUCCESS' } }
                failure { script { env.STAGE_TEST = 'FAILED' } }
                aborted { script { env.STAGE_TEST = 'ABORTED' } }
            }
        }

        stage('Build images') {
            steps {
                sh '''
                    set -eu
                    docker build --pull \
                        --file application/Dockerfile \
                        --tag "ai-devops-application:${IMAGE_TAG}" .
                    docker build --pull \
                        --file Dockerfile \
                        --tag "ai-devops-operations:${IMAGE_TAG}" .
                '''
            }
            post {
                success { script { env.STAGE_BUILD_IMAGES = 'SUCCESS' } }
                failure { script { env.STAGE_BUILD_IMAGES = 'FAILED' } }
                aborted { script { env.STAGE_BUILD_IMAGES = 'ABORTED' } }
            }
        }

        stage('Validate deployment configuration') {
            when {
                expression {
                    def branch = env.BRANCH_NAME ?: env.GIT_BRANCH ?: ''
                    return branch in ['main', 'origin/main', '*/main', 'refs/heads/main']
                }
            }
            steps {
                script {
                    env.ECR_REGISTRY = "${env.DEPLOY_ACCOUNT_ID}.dkr.ecr.${env.DEPLOY_REGION}.amazonaws.com"
                }
                sh '''
                    set -eu
                    : "${DEPLOY_REGION:?Configure AWS_REGION in Jenkins}"
                    : "${DEPLOY_ACCOUNT_ID:?Configure AWS_ACCOUNT_ID in Jenkins}"
                    : "${ECR_REPOSITORY:?Configure ECR_REPOSITORY_NAME in Jenkins}"
                    : "${EC2_DEPLOY_HOST:?Configure EC2_HOST in Jenkins}"
                    : "${DASHBOARD_BASE_URL:?Configure DASHBOARD_BASE_URL in Jenkins}"
                    case "$DASHBOARD_BASE_URL" in
                        https://*) ;;
                        *) echo "DASHBOARD_BASE_URL must use HTTPS to protect the reporting token."; exit 1 ;;
                    esac
                    command -v aws >/dev/null
                    export AWS_DEFAULT_REGION="$DEPLOY_REGION"
                    aws sts get-caller-identity >/dev/null
                    aws ecr describe-repositories \
                        --registry-id "$DEPLOY_ACCOUNT_ID" \
                        --repository-names "$ECR_REPOSITORY" >/dev/null
                    command -v ssh >/dev/null
                    command -v scp >/dev/null
                '''
                withCredentials([
                    sshUserPrivateKey(
                        credentialsId: env.SSH_CREDENTIAL_ID,
                        keyFileVariable: 'SSH_KEY_CHECK',
                        usernameVariable: 'SSH_USER_CHECK'
                    ),
                    string(
                        credentialsId: env.DASHBOARD_TOKEN_CREDENTIAL_ID,
                        variable: 'DASHBOARD_TOKEN_CHECK'
                    )
                ]) {
                    sh 'test -s "$SSH_KEY_CHECK" && test -n "$SSH_USER_CHECK" && test -n "$DASHBOARD_TOKEN_CHECK"'
                }
            }
            post {
                success { script { env.STAGE_VALIDATE_DEPLOY = 'SUCCESS' } }
                failure { script { env.STAGE_VALIDATE_DEPLOY = 'FAILED' } }
                aborted { script { env.STAGE_VALIDATE_DEPLOY = 'ABORTED' } }
            }
        }

        stage('Push images to ECR') {
            when {
                expression {
                    def branch = env.BRANCH_NAME ?: env.GIT_BRANCH ?: ''
                    return branch in ['main', 'origin/main', '*/main', 'refs/heads/main']
                }
            }
            steps {
                sh '''
                    set -eu
                    export AWS_DEFAULT_REGION="$DEPLOY_REGION"
                    aws ecr get-login-password --region "$DEPLOY_REGION" \
                        | docker login --username AWS --password-stdin "$ECR_REGISTRY"

                    docker tag "ai-devops-application:${IMAGE_TAG}" \
                        "$ECR_REGISTRY/$ECR_REPOSITORY:application-${IMAGE_TAG}"
                    docker tag "ai-devops-operations:${IMAGE_TAG}" \
                        "$ECR_REGISTRY/$ECR_REPOSITORY:operations-${IMAGE_TAG}"
                    docker push "$ECR_REGISTRY/$ECR_REPOSITORY:application-${IMAGE_TAG}"
                    docker push "$ECR_REGISTRY/$ECR_REPOSITORY:operations-${IMAGE_TAG}"
                '''
            }
            post {
                success { script { env.STAGE_PUSH_IMAGES = 'SUCCESS' } }
                failure { script { env.STAGE_PUSH_IMAGES = 'FAILED' } }
                aborted { script { env.STAGE_PUSH_IMAGES = 'ABORTED' } }
            }
        }

        stage('Deploy to EC2') {
            when {
                expression {
                    def branch = env.BRANCH_NAME ?: env.GIT_BRANCH ?: ''
                    return branch in ['main', 'origin/main', '*/main', 'refs/heads/main']
                }
            }
            steps {
                script {
                    env.ECR_REGISTRY = "${env.DEPLOY_ACCOUNT_ID}.dkr.ecr.${env.DEPLOY_REGION}.amazonaws.com"
                }
                withCredentials([
                    sshUserPrivateKey(
                        credentialsId: env.SSH_CREDENTIAL_ID,
                        keyFileVariable: 'SSH_KEY',
                        usernameVariable: 'SSH_USER'
                    )
                ]) {
                    sh '''
                        set -eu
                        : "${EC2_DEPLOY_HOST:?Configure EC2_HOST in Jenkins}"
                        : "${EC2_DEPLOY_PATH:?Configure EC2_DEPLOY_PATH in Jenkins}"
                        command -v ssh >/dev/null
                        command -v scp >/dev/null
                        ssh_options="-i $SSH_KEY -o BatchMode=yes -o StrictHostKeyChecking=yes"
                        ssh_user="${EC2_DEPLOY_USER:-$SSH_USER}"

                        ssh $ssh_options "$ssh_user@$EC2_DEPLOY_HOST" \
                            "sudo -n true && mkdir -p '$EC2_DEPLOY_PATH' && test -f '$EC2_DEPLOY_PATH/.env'"
                        scp $ssh_options docker-compose.yml \
                            "$ssh_user@$EC2_DEPLOY_HOST:$EC2_DEPLOY_PATH/docker-compose.yml"

                        ssh $ssh_options "$ssh_user@$EC2_DEPLOY_HOST" \
                            "DEPLOY_PATH='$EC2_DEPLOY_PATH' \
                            DEPLOY_REGION='$DEPLOY_REGION' \
                            ECR_REGISTRY='$ECR_REGISTRY' \
                            ECR_REPOSITORY='$ECR_REPOSITORY' \
                            IMAGE_TAG='$IMAGE_TAG' bash -s" <<'REMOTE'
                        set -eu
                        cd "$DEPLOY_PATH"
                        aws ecr get-login-password --region "$DEPLOY_REGION" \
                            | sudo -n docker login --username AWS --password-stdin "$ECR_REGISTRY"

                        export APP_IMAGE="$ECR_REGISTRY/$ECR_REPOSITORY:application-$IMAGE_TAG"
                        export OPS_IMAGE="$ECR_REGISTRY/$ECR_REPOSITORY:operations-$IMAGE_TAG"
                        sudo -n env APP_IMAGE="$APP_IMAGE" OPS_IMAGE="$OPS_IMAGE" docker compose pull
                        sudo -n env APP_IMAGE="$APP_IMAGE" OPS_IMAGE="$OPS_IMAGE" docker compose up -d --no-build --remove-orphans
                        sudo -n env APP_IMAGE="$APP_IMAGE" OPS_IMAGE="$OPS_IMAGE" docker compose ps
REMOTE
                    '''
                }
            }
            post {
                success { script { env.STAGE_DEPLOY = 'SUCCESS' } }
                failure { script { env.STAGE_DEPLOY = 'FAILED' } }
                aborted { script { env.STAGE_DEPLOY = 'ABORTED' } }
            }
        }

        stage('Health check') {
            when {
                expression {
                    def branch = env.BRANCH_NAME ?: env.GIT_BRANCH ?: ''
                    return branch in ['main', 'origin/main', '*/main', 'refs/heads/main']
                }
            }
            steps {
                withCredentials([
                    sshUserPrivateKey(
                        credentialsId: env.SSH_CREDENTIAL_ID,
                        keyFileVariable: 'SSH_KEY',
                        usernameVariable: 'SSH_USER'
                    )
                ]) {
                    sh '''
                        set -eu
                        ssh_options="-i $SSH_KEY -o BatchMode=yes -o StrictHostKeyChecking=yes"
                        ssh_user="${EC2_DEPLOY_USER:-$SSH_USER}"
                        ssh $ssh_options "$ssh_user@$EC2_DEPLOY_HOST" \
                            "DEPLOY_PATH='$EC2_DEPLOY_PATH' bash -s" <<'REMOTE'
                        set -eu
                        cd "$DEPLOY_PATH"
                        attempt=0
                        until sudo -n docker compose exec -T application \
                            curl -fsS http://127.0.0.1:5000/health >/dev/null \
                            && sudo -n docker compose exec -T dashboard \
                            curl -fsS http://127.0.0.1:5050/ >/dev/null; do
                            attempt=$((attempt + 1))
                            if [ "$attempt" -ge 30 ]; then
                                sudo -n docker compose ps
                                sudo -n docker compose logs --tail=100
                                exit 1
                            fi
                            sleep 2
                        done
                        sudo -n docker compose ps
REMOTE
                    '''
                }
            }
            post {
                success { script { env.STAGE_HEALTH_CHECK = 'SUCCESS' } }
                failure { script { env.STAGE_HEALTH_CHECK = 'FAILED' } }
                aborted { script { env.STAGE_HEALTH_CHECK = 'ABORTED' } }
            }
        }
    }

    post {
        always {
            script {
                def branch = env.BRANCH_NAME ?: env.GIT_BRANCH ?: ''
                if (branch in ['main', 'origin/main', '*/main', 'refs/heads/main']) {
                    def result = currentBuild.currentResult ?: 'FAILURE'
                    env.PIPELINE_STATUS = result in ['SUCCESS', 'UNSTABLE', 'ABORTED']
                        ? result
                        : 'FAILED'
                    env.BUILD_DURATION = currentBuild.durationString.replace(' and counting', '')
                    try {
                        withCredentials([
                            string(
                                credentialsId: env.DASHBOARD_TOKEN_CREDENTIAL_ID,
                                variable: 'JENKINS_DASHBOARD_TOKEN'
                            )
                        ]) {
                            sh '''
                                set -eu
                                python3 - <<'PY' > deployment-payload.json
import json
import os

result = os.environ.get("PIPELINE_STATUS", "FAILED")
payload = {
    "build_number": int(os.environ["BUILD_NUMBER"]),
    "job_name": os.environ.get("JOB_NAME", "jenkins"),
    "branch": os.environ.get("BRANCH_NAME") or os.environ.get("GIT_BRANCH", "main"),
    "commit": os.environ.get("GIT_COMMIT", "unknown"),
    "status": result,
    "duration": os.environ.get("BUILD_DURATION", "unknown"),
    "build_url": os.environ.get("BUILD_URL", ""),
    "stages": [
        {"name": "Checkout", "status": os.environ["STAGE_CHECKOUT"]},
        {"name": "Validate build agent", "status": os.environ["STAGE_VALIDATE_AGENT"]},
        {"name": "Test", "status": os.environ["STAGE_TEST"]},
        {"name": "Build images", "status": os.environ["STAGE_BUILD_IMAGES"]},
        {"name": "Validate deploy config", "status": os.environ["STAGE_VALIDATE_DEPLOY"]},
        {"name": "Push images to ECR", "status": os.environ["STAGE_PUSH_IMAGES"]},
        {"name": "Deploy to EC2", "status": os.environ["STAGE_DEPLOY"]},
        {"name": "Health check", "status": os.environ["STAGE_HEALTH_CHECK"]},
    ],
}
print(json.dumps(payload))
PY
                                curl --fail --silent --show-error \
                                    --connect-timeout 5 --max-time 15 \
                                    -H "Authorization: Bearer $JENKINS_DASHBOARD_TOKEN" \
                                    -H "Content-Type: application/json" \
                                    --data-binary @deployment-payload.json \
                                    "${DASHBOARD_BASE_URL%/}/api/integrations/jenkins/deployments"
                            '''
                        }
                    } catch (Exception err) {
                        echo "Jenkins deployment history reporting failed: ${err.message}"
                        currentBuild.result = 'UNSTABLE'
                    }
                }
            }
            cleanWs()
        }
        success {
            echo "CI passed for image tag ${env.IMAGE_TAG}."
        }
        failure {
            echo 'CI/CD failed. Review the failed stage before retrying deployment.'
        }
    }
}
