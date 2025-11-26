# Deployment Guide: AWS (S3/EC2) + Convex

This guide outlines how to deploy your ScienceUtsav application.
**Architecture:**
- **Backend:** Hosted on Convex Cloud (Managed).
- **Frontend:** Hosted on AWS (S3 or EC2).

## Prerequisites
- AWS Account.
- Node.js and pnpm installed locally.
- AWS CLI (optional, but helpful).

---

## Step 1: Deploy the Backend (Convex)

Since Convex is a managed service, you deploy your backend functions directly to their platform.

1. **Login to Convex:**
   Run `npx convex login` if you haven't already.

2. **Deploy to Production:**
   Run the following command to push your functions to the production environment:
   
   ```bash
   npx convex deploy
   ```

3. **Verify Deployment:**
   Check the Convex dashboard to confirm your functions are live and accessible.

4. **Set Up Environment Variables:**
   Ensure your environment variables are correctly configured in the Convex dashboard.

5. **Test Your Functions:**
   Use the Convex dashboard or API to test your deployed functions.

---

## Step 2: Deploy the Frontend (AWS)

Now that your backend is live, deploy your frontend application to AWS.

1. **Choose Deployment Method:**
   - **Option A (S3):** Use S3 for static hosting (recommended for simple applications).
   - **Option B (EC2):** Use EC2 for more complex or dynamic applications.

2. **Prepare Your Frontend:**
   - Build your frontend application using `pnpm build`.
   - Ensure all environment variables are set in your `.env` file.

3. **Deploy to S3 (Recommended):**
   - Create an S3 bucket in your AWS account.
   - Upload your built frontend files to the S3 bucket.
   - Configure S3 to serve static content.

4. **Deploy to EC2 (Advanced):**
   - Launch an EC2 instance with the required OS and dependencies.
   - Install Node.js and pnpm.
   - Deploy your frontend application using `pnpm start`.

5. **Configure Domain and SSL:**
   - Set up a domain name (e.g., `yourapp.com`).
   - Configure SSL certificates for secure connections.

6. **Test the Full Application:**
   - Access your application through the domain name.
   - Verify that all features work correctly with the backend API.

---

## Step 3: Set Up API Gateway (Optional)

For a more robust setup, consider setting up an API Gateway to manage API calls between your frontend and backend.

1. **Create an API Gateway:**
   - Use AWS API Gateway to create a new REST API.
   - Configure routes to forward requests to your Convex backend functions.

2. **Set Up CORS:**
   - Configure CORS (Cross-Origin Resource Sharing) to allow requests from your frontend.

3. **Integrate with Frontend:**
   - Update your frontend code to use the API Gateway endpoint instead of direct Convex API calls.

4. **Test the Integration:**
   - Verify that requests are properly routed and responses are correctly formatted.

---

## Step 4: Set Up CloudFront (Recommended for HTTPS)

To serve your site over HTTPS and improve performance, set up a CloudFront distribution.

1.  **Go to CloudFront Console:**
    - Navigate to the AWS CloudFront service.
    - Click **Create distribution**.

2.  **Configure Origin:**
    - **Origin Domain:** Paste your **S3 Website Endpoint** here (e.g., `my-bucket.s3-website.ap-south-1.amazonaws.com`).
    - **Important:** Do NOT select the bucket from the dropdown list. Paste the website endpoint URL you got from the S3 Static Hosting settings.
    - **Protocol:** HTTP only.

3.  **Default Cache Behavior:**
    - **Viewer protocol policy:** Select **Redirect HTTP to HTTPS**.
    - **Allowed HTTP methods:** Select `GET, HEAD, OPTIONS`.

4.  **Create Distribution:**
    - Click **Create distribution**.
    - Wait for the deployment to finish (it may take a few minutes).

5.  **Update Convex Environment Variable:**
    - Copy your new CloudFront Domain Name (e.g., `https://d12345.cloudfront.net`).
    - Go to your **Convex Dashboard** -> **Settings** -> **Environment Variables**.
    - Update `SITE_URL` (in Production) to this new CloudFront URL.

---

## Step 6: Set Up Custom Domain (Optional)

To use a custom domain (e.g., `www.yourdomain.com`) instead of the CloudFront URL:

1.  **Request an SSL Certificate (ACM):**
    *   Go to **AWS Certificate Manager (ACM)**.
    *   **Important:** Switch region to **US East (N. Virginia) us-east-1**. CloudFront requires certificates in this region.
    *   Click **Request a certificate**.
    *   Enter your domain name (e.g., `example.com` and `*.example.com`).
    *   Follow instructions to validate the certificate (usually via DNS validation).

2.  **Add Domain to CloudFront:**
    *   Go to your **CloudFront Distribution**.
    *   Click **Edit** under the **General** tab.
    *   **Alternate Domain Names (CNAMEs):** Add your domain (e.g., `www.yourdomain.com`).
    *   **Custom SSL Certificate:** Select the certificate you just created in ACM.
    *   Click **Save changes**.

3.  **Update DNS Records:**
    *   **If using AWS Route 53:**
        *   Go to your Hosted Zone.
        *   Create a new **A Record**.
        *   Toggle **Alias** to Yes.
        *   Choose **Alias to CloudFront distribution**.
        *   Select your distribution.
    *   **If using another DNS provider (GoDaddy, Namecheap, etc.):**
        *   Create a **CNAME record**.
        *   Host: `www` (or `@` if supported).
        *   Value: Your CloudFront Domain Name (e.g., `d12345.cloudfront.net`).

4.  **Update Convex Environment Variable:**
    *   Don't forget to update `SITE_URL` in Convex to your new custom domain (e.g., `https://www.yourdomain.com`).

---

## Step 7: Monitor and Maintain

1. **Monitor Performance:**
   - Use AWS CloudWatch to monitor application performance and logs.

2. **Set Up Alerts:**
   - Configure alerts for high CPU usage, memory issues, or failed requests.

3. **Backup and Recovery:**
   - Regularly back up your S3 bucket and EC2 instances.
   - Set up automated backups and recovery procedures.

4. **Security:**
   - Regularly update your AWS services and dependencies.
   - Implement security best practices for your application.

5. **Scaling:**
   - Monitor traffic patterns and scale your EC2 instances as needed.

6. **Cost Management:**
   - Review AWS billing and set up cost allocation tags.

---

## Troubleshooting

1. **Connection Issues:**
   - Ensure your AWS and Convex accounts are properly configured.
   - Check network firewalls and security groups.

2. **Deployment Failures:**
   - Verify that all required dependencies are installed.
   - Check environment variables and configuration files.

3. **API Errors:**
   - Review the Convex dashboard for function errors.
   - Check AWS CloudWatch logs for detailed error information.

4. **Performance Issues:**
   - Optimize your code and database queries.
   - Consider caching strategies for frequently accessed data.

5. **Security Vulnerabilities:**
   - Regularly scan your code for security issues.
   - Update dependencies to the latest secure versions.

---

## Final Notes

- This guide assumes you have basic familiarity with AWS and Node.js.
- For more complex applications, consider using AWS Amplify or other full-stack frameworks.
- Always follow security best practices and keep your application updated.

Happy deploying!