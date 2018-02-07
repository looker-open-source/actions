export const s3Regions = [
  // http://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region
  {name: "us-east-1", label: "US East (N. Virginia)"},
  {name: "us-east-2", label: "US East (Ohio)"},
  {name: "us-west-1", label: "US West (N. California)"},
  {name: "us-west-2", label: "US West (Oregon)"},
  {name: "ca-central-1", label: "Canada (Central)"},
  {name: "ap-south-1", label: "Asia Pacific (Mumbai)"},
  {name: "ap-northeast-2", label: "Asia Pacific (Seoul)"},
  {name: "ap-southeast-1", label: "Asia Pacific (Singapore)"},
  {name: "ap-southeast-2", label: "Asia Pacific (Sydney)"},
  {name: "ap-northeast-1", label: "Asia Pacific (Tokyo)"},
  {name: "eu-central-1", label: "EU (Frankfurt)"},
  {name: "eu-west-1", label: "EU (Ireland)"},
  {name: "eu-west-2", label: "EU (London)"},
  {name: "sa-east-1", label: "South America (São Paulo)"},
]

// http://docs.aws.amazon.com/general/latest/gr/rande.html#ec2_region
export const ec2Regions = s3Regions.concat([
  {name: "cn-northwest-1", label: "China (Ningxia)"},
])
