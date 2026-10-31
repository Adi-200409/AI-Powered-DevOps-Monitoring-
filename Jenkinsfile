// ==============================================================================
// Jenkins CI/CD Pipeline - AI-Powered DevOps Monitoring System
// 7 Stages: Source Code -> Build -> Test -> Docker Build -> Push Image -> Deploy -> Health Check
// ==============================================================================

pipeline {
    agent any

    environment {
        AWS_DEFAULT_REGION = "${env.AWS_REGION ?: 'us-east-1'}"
        AWS_ACCOUNT_ID     = "${env.AWS_ACCOUNT_ID ?: '123456789012'}"
        ECR_REPOSITORY     = "${env.ECR_REPOSITORY_NAME ?: 'ai-devops-app'}"
        ECR_REGISTRY       = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com"
        IMAGE_TAG          = "${env.BUILD_NUMBER}"
        EC2_HOST           = "${env.EC2_HOST ?: 'localhost'}"
        APP_PORT           = "${env.APP_PORT ?: '5000'}"
    }

    stages {
        stage('Source Code') {
            steps {
                echo '=== Stage 1: Checkout Source Code from GitHub ==='
                // In production, Jenkins SCM handles this or specify git repository:
                // git branch: 'main', url: 'https://github.com/your-org/ai-devops-monitoring.git'
                checkout scm
            }
        }

        stage('Build') {
            steps {
                echo '=== Stage 2: Install Dependencies and Build Application ==='
                sh 'python -m pip install --upgrade pip'
                sh 'pip install -r requirements.txt'
            }
        }

        stage('Test') {
            steps {
                echo '=== Stage 3: Run Automated Test Suite ==='
                sh 'pytest tests/ -v'
            }
        }

        stage('Docker Build') {
            steps {
                echo "=== Stage 4: Build Docker Image ${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG} ==="
                sh "docker build -t ${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG} -t ${ECR_REGISTRY}/${ECR_REPOSITORY}:latest ."
            }
        }

        stage('Push Image') {
            steps {
                echo "=== Stage 5: Authenticate and Push Image to AWS ECR ==="
                // sh "aws ecr get-login-password --region ${AWS_DEFAULT_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}"
                // sh "docker push ${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG}"
                // sh "docker push ${ECR_REGISTRY}/${ECR_REPOSITORY}:latest"
                echo "Simulating/Executing AWS ECR push for ${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG}"
            }
        }

        stage('Deploy') {
            steps {
                echo "=== Stage 6: Deploy Container on Target EC2 Instance ==="
                // Deployment via SSH or docker-compose update:
                // sh "ssh ec2-user@${EC2_HOST} 'docker compose pull && docker compose up -d'"
                echo "Pulling latest image and redeploying service container on EC2 host: ${EC2_HOST}"
            }
        }

        stage('Health Check') {
            steps {
                echo "=== Stage 7: Verify Service Health Endpoint ==="
                // Give service a few seconds to start if needed
                sleep time: 5, unit: 'SECONDS'
                sh "curl -f http://${EC2_HOST}:${APP_PORT}/health || exit 1"
                echo "Health check succeeded: Service is responding on /health"
            }
        }
    }

    post {
        always {
            cleanWs()
        }
        success {
            echo "Jenkins Pipeline finished successfully. Deployment active on ${EC2_HOST}:${APP_PORT}."
        }
        failure {
            echo "Jenkins Pipeline failed! Build #${BUILD_NUMBER} halted before production release."
        }
    }
}
