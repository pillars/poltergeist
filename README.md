# Poltergeist

Poltergeist is a build tool to develop static websites and deploy them to S3 and Cloudfront.

## Getting started

```
git clone https://github.com/pillars/poltergeist.git
rm -rf .git README.md CHANGELOG.md
npm install -g gulp
npm install
```

We remove the `.git` folder because there is no benefit in keeping ties with this repository. You can instantiate a new repository for your project with `git init`.

## Development

While you are developing, simply run `gulp`. It starts a server and watches for changes, recompiling the assets and templates. By default, the site will run at `localhost:8000`.

## Deploy

When come the time to deploy to S3 and Cloudfront, you first want to configure your credentials:


```
cp .env.example .env
```

- PRODUCTION_ASSET_URL: The cloudfront or S3 domain name where the site is hosted. Something like `abcdefg123456.cloudfront.net`
- S3_BUCKET: The S3 bucket where the site is hosted. I usually use the domain name like `yoursite.com`
- AWS_REGION: The AWS region of the bucket. See docs [here](https://docs.aws.amazon.com/general/latest/gr/rande.html).
- AWS_ACCESS_KEY_ID: The AWS access key
- AWS_SECRET_ACCESS_KEY: The AWS secret access key
- CLOUDFRONT_DISTRIBUTION: The CloudFront distribution id

You also want to make sure that the AWS keys have access to the S3 bucket and Cloudfront. Once that's the case, you can deploy by running `gulp build:deploy`.
