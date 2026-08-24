import { HclParserService } from "./modules/simulation/services/hcl-parser.service";
import { generateTerraformJson } from "./modules/terraform/services/generation";

const parser = new HclParserService();

const hclCode = `# ─── VPC & Subnets ───
resource "aws_vpc" "vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = {
    Name = "simulation-vpc"
  }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.vpc.id
  tags = {
    Name = "simulation-igw"
  }
}

resource "aws_subnet" "public_1" {
  vpc_id            = aws_vpc.vpc.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = "us-east-1a"
  map_public_ip_on_launch = true
  tags = {
    Name = "public-subnet-1"
  }
}

resource "aws_subnet" "public_2" {
  vpc_id            = aws_vpc.vpc.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = "us-east-1b"
  map_public_ip_on_launch = true
  tags = {
    Name = "public-subnet-2"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.vpc.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }
  tags = {
    Name = "public-route-table"
  }
}

resource "aws_route_table_association" "public_1" {
  subnet_id      = aws_subnet.public_1.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_2" {
  subnet_id      = aws_subnet.public_2.id
  route_table_id = aws_route_table.public.id
}

# ─── Security Groups ───
resource "aws_security_group" "elb_sg" {
  name        = "elb-security-group"
  vpc_id      = aws_vpc.vpc.id
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "ec2_sg" {
  name        = "ec2-security-group"
  vpc_id      = aws_vpc.vpc.id
  ingress {
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.elb_sg.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ─── Static Targets (Phase A) ───
resource "aws_instance" "ec2_app_server_1" {
  ami                    = "ami-0440d3b780d96b29d" # Amazon Linux 2023 AMI
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.public_1.id
  vpc_security_group_ids = [aws_security_group.ec2_sg.id]
  user_data              = <<-EOF
              #!/bin/bash
              dnf install -y httpd
              systemctl start httpd
              systemctl enable httpd
              echo "<h1>Hello from Static Server 1</h1>" > /var/www/html/index.html
              EOF
  tags = {
    Name = "ec2-app-server-1"
  }
}

resource "aws_instance" "ec2_app_server_2" {
  ami                    = "ami-0440d3b780d96b29d"
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.public_2.id
  vpc_security_group_ids = [aws_security_group.ec2_sg.id]
  user_data              = <<-EOF
              #!/bin/bash
              dnf install -y httpd
              systemctl start httpd
              systemctl enable httpd
              echo "<h1>Hello from Static Server 2</h1>" > /var/www/html/index.html
              EOF
  tags = {
    Name = "ec2-app-server-2"
  }
}

# ─── Target Group & Load Balancer ───
resource "aws_lb_target_group" "tg" {
  name     = "app-target-group"
  port     = 80
  protocol = "HTTP"
  vpc_id   = aws_vpc.vpc.id
  health_check {
    path                = "/"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 15
    timeout             = 3
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }
}

resource "aws_lb_target_group_attachment" "ec2_1" {
  target_group_arn = aws_lb_target_group.tg.arn
  target_id        = aws_instance.ec2_app_server_1.id
  port             = 80
}

resource "aws_lb_target_group_attachment" "ec2_2" {
  target_group_arn = aws_lb_target_group.tg.arn
  target_id        = aws_instance.ec2_app_server_2.id
  port             = 80
}

resource "aws_lb" "elb" {
  name               = "app-load-balancer"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.elb_sg.id]
  subnets            = [aws_subnet.public_1.id, aws_subnet.public_2.id]
  tags = {
    Name = "app-load-balancer"
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.elb.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.tg.arn
  }
}

# ─── Dynamic Scaling (Phase B) ───
resource "aws_launch_template" "app_template" {
  name_prefix   = "app-template"
  image_id      = "ami-0440d3b780d96b29d"
  instance_type = "t3.micro"
  network_interfaces {
    associate_public_ip_address = true
    security_groups             = [aws_security_group.ec2_sg.id]
  }
  user_data = base64encode(<<-EOF
              #!/bin/bash
              dnf install -y httpd
              systemctl start httpd
              systemctl enable httpd
              echo "<h1>Hello from AutoScaled Server</h1>" > /var/www/html/index.html
              EOF
  )
}

resource "aws_autoscaling_group" "asg" {
  vpc_zone_identifier = [aws_subnet.public_1.id, aws_subnet.public_2.id]
  target_group_arns   = [aws_lb_target_group.tg.arn]
  desired_capacity    = 2
  min_size            = 2
  max_size            = 5

  launch_template {
    id      = aws_launch_template.app_template.id
    version = "$Latest"
  }
}
`;

try {
  console.log("Parsing HCL to graph...");
  const parsed = parser.parse(hclCode);
  console.log("Parsed successfully! Node count:", parsed.nodes.length, "Edge count:", parsed.edges.length);
  
  console.log("Compiling graph to Terraform...");
  const compileReq = {
    nodes: parsed.nodes,
    edges: parsed.edges,
    region: "us-east-1",
    provider: "aws" as const
  };
  const result = generateTerraformJson(compileReq);
  console.log("Compiled successfully!");
  
  const stringifiedJson = JSON.stringify(result.terraformJson, null, 2);
  console.log("Stringified JSON length:", stringifiedJson.length);
  
  // Try to parse the stringified JSON
  JSON.parse(stringifiedJson);
  console.log("SUCCESS: stringified JSON is perfectly valid!");
} catch (err: any) {
  console.error("FAILED with error:", err);
}
