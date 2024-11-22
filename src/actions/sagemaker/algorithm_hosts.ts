// list of hosts for Amazon-provided training algorithm images
// https://docs.aws.amazon.com/sagemaker/latest/dg/sagemaker-algo-docker-registry-paths.html

export const xgboostHosts: { [key: string]: string } = {
  "us-west-1": "632365934929.dkr.ecr.us-west-1.amazonaws.com​",
  "us-west-2": "433757028032.dkr.ecr.us-west-2.amazonaws.com",
  "us-east-1": "811284229777.dkr.ecr.us-east-1.amazonaws.com",
  "us-east-2": "825641698319.dkr.ecr.us-east-2.amazonaws.com",
  "us-gov-west-1": "226302683700.dkr.ecr.us-gov-west-1.amazonaws.com",
  "ap-northeast-1": "501404015308.dkr.ecr.ap-northeast-1.amazonaws.com",
  "ap-northeast-2": "306986355934.dkr.ecr.ap-northeast-2.amazonaws.com",
  "ap-south-1": "991648021394.dkr.ecr.ap-south-1.amazonaws.com",
  "ap-southeast-1": "475088953585.dkr.ecr.ap-southeast-1.amazonaws.com",
  "ap-southeast-2": "544295431143.dkr.ecr.ap-southeast-2.amazonaws.com",
  "ca-central-1": "469771592824.dkr.ecr.ca-central-1.amazonaws.com",
  "eu-central-1": "813361260812.dkr.ecr.eu-central-1.amazonaws.com",
  "eu-west-1": "685385470294.dkr.ecr.eu-west-1.amazonaws.com",
  "eu-west-2": "644912444149.dkr.ecr.eu-west-2.amazonaws.com",
}

export const linearLearnerHosts: { [key: string]: string } = {
  "us-west-1": "632365934929.dkr.ecr.us-west-1.amazonaws.com",
  "us-west-2": "174872318107.dkr.ecr.us-west-2.amazonaws.com",
  "us-east-1": "382416733822.dkr.ecr.us-east-1.amazonaws.com",
  "us-east-2": "404615174143.dkr.ecr.us-east-2.amazonaws.com",
  "us-gov-west-1": "226302683700.dkr.ecr.us-gov-west-1.amazonaws.com",
  "ap-northeast-1": "351501993468.dkr.ecr.ap-northeast-1.amazonaws.com",
  "ap-northeast-2": "835164637446.dkr.ecr.ap-northeast-2.amazonaws.com",
  "ap-south-1": "991648021394.dkr.ecr.ap-south-1.amazonaws.com",
  "ap-southeast-1": "475088953585.dkr.ecr.ap-southeast-1.amazonaws.com",
  "ap-southeast-2": "712309505854.dkr.ecr.ap-southeast-2.amazonaws.com",
  "ca-central-1": "469771592824.dkr.ecr.ca-central-1.amazonaws.com",
  "eu-central-1": "664544806723.dkr.ecr.eu-central-1.amazonaws.com",
  "eu-west-1": "438346466558.dkr.ecr.eu-west-1.amazonaws.com",
  "eu-west-2": "644912444149.dkr.ecr.eu-west-2.amazonaws.com",
}

export const ecrHosts: { [key: string]: { [key: string]: string } } = {
  "xgboost": xgboostHosts,
  "linear-learner": linearLearnerHosts,
}
