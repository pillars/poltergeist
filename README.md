# Poltergeist

Welcome to Poltergeist, yet another static site generator based on Gulp. Here is a quick summary of what it does:

- Static and simple
- Supports HTML with inline Markdown
- Supports Markdown with inline html
- Supports FrontMatter to add meta-data
- Supports advanced layouts and templates
- Supports SASS
- Concatenates, minifies, versions and gzip assets (images, fonts, css, js and html)
- Generates a RSS feed
- One command to develop for with `gulp`
- One command deploy to S3 with `gulp deploy`
- Supports Cloudfront distributions and manage cache invalidation

---

## Documentation

- [Getting started](#getting-started)
- [Templating](#templating)
  - [Nunjucks](#nunjucks)
  - [Markdown](#markdown)
- [Posts and Pages](#posts-and-pages)
  - [Posts](#posts)
  - [Pages](#pages)
- [Assets](#assets)
  - [Javascript](#javascript)
  - [CSS](#css)
- [Deploy to S3 and Cloudfront](#deploy-to-s3-and-cloudfront)

### Getting started

```
git clone https://github.com/pillars/poltergeist.git
rm -rf .git README.md CHANGELOG.md
npm install -g gulp
npm install
cp .env.example .env
```

We remove the `.git` folder because there is no benefit in keeping ties with this repository. You can instantiate a new repository for your project with `git init`.

You can skip setting the values in the `.env` file for now but you will need them for deploying. You will want to edit the `src/site.json` file though to enter your site information:

- **title**: The default title for the site (can be overridden for each page)
- **url**: The site url
- **author**: Who are you?
- **email**: Where can we reach you?
- **feed**: How do you want to name your RSS feed? Leave blank to disable the RSS feed.

To start the development server, simply run `gulp`. It also watches for changes, recompiling the assets and templates. By default, the site will run at `localhost:8000`.

### Templating

Templating is done with nunjunks. You can quite easilly replace the renderer by playing with the `renderHTML()` function in the Gulpfile. Poltergeist works with HTML (nunjunks templates), Markdown or any combination of the two.

#### Nunjucks

If you want to create pages with complex layout and logic, Poltergeist supports nunjucks templates. Let's look at the `index.html`:

```
---
title: My Site
---

{% extends "layout.html" %}

{% block content %}
  <div class="container">
    {% for post in posts %}
    <div class="post">
      <h2 class="post-title">
        <a href="{{post.url}}">
          {{post.title}}
        </a>
      </h2>
      <p class="post-excerpt">
        {{post.excerpt}}
      </p>
      <p class="post-meta">
        {{post.date}}
        {% if post.tags.length %}
           -
          {% for tag in post.tags %}
            {{tag}},
          {% endfor %}
        {% endif %}
      </p>
    </div>
    {% endfor %}
  </div>
{% endblock %}
```

This extends the `layout.html` and the Front Matter defines the `title` that will be used for the page. It also loops through the posts but we will get to that shortly.

If you feel like adding some markdown to your nunjucks template, no worries. Do something like that:

```
{% markdown %}
# This is markdown in a nunjucks tempalte
{% endmarkdown %}
```

#### Markdown

There are time when you simply want to write content and HTML is overkill. So we support markdown files with the `.md` extension. Let's look at an example:


```
---
title: My Site
---

# This is a <span>Markdown</span> title
```

We still have the title. Note that we do not declare a layout, but it will use `layout.html` by default. You can change that by adding a `layout: mylayout.html` to the Front Matter. Another thing worth noting is that HTML isn't escapte so you can use some inline HTML. It is convenient when you need some flexibility.

### Posts and Pages

Templates come in two flavors: Posts and Pages. Each have its own directory.

#### Posts

Every post must be a folder formatted like `src/posts/2016-06-24-slug` with an `index.html` in it. It allows to have a pretty url like `/2016/06/slug` as well as ordering the posts. Poltergeist leaves the day out of the url because there is no benefit. Some people dislike having the date in the url, I think it is of great value. I want to know at first sight if I'm reading a recent or old article.

The Front Matter for posts can take whatever you feel like. There is an `excerpt` key in the example file. Note that the `date` and `url` fields are auto generated from the folder name.

You can keep the images related to a post inside the post folder. Simply create an `images/` folder. Inside your post, the `imageFolder` variable allows you to forget about where the files are. To add an image do something like:

```html
<img src="{{imageFolder}}/image.png" alt="" />
```

or:

```markdown
[]({{imageFolder}})
```

#### Pages

There is no constraint of format here. You can use the same strategy as posts by using folders and `index.html` files or you create `whatever.html` files.

#### Other

- [Define Open Graph meta tags for Social Sharing](/docs/open-graph.md)

### Assets

#### Javascript

Poltergeist comes with a single `scripts.js` file. It might be enough for a small site but it also has its limits. Good news, we already have nunjucks for templating so you can use it here too. Any file in the `src/assets/js/` folder can be included. It is up to you to take care of the order and make sure things are properly included. Simply add this for instance `{% include "./vendor.js" %}` and the `src/assets/js/vendor.js` file will be included.

All javascript file are uglified before being deployed.

### CSS

Poltergeist comes with SASS support. If you want to organize your CSS in multiple files, refer to the SASS documentation. It basically consist of adding something like `@import 'prism';` and the `src/assets/css/_vendor.scss` file will be included (note the underscore).

All css files are minified before being deployed.

### Deploy to S3 and Cloudfront

Poltergeist will upload your site to the specified bucket on S3 and if you have a CloudFront distribution, it will make sure to invalidate what needs to be. But first you want to configure your credentials in the `.env`:

- PRODUCTION_ASSET_URL: The cloudfront or S3 domain name where the site is hosted. Something like `abcdefg123456.cloudfront.net`
- S3_BUCKET: The S3 bucket where the site is hosted. I usually use the domain name like `yoursite.com`
- AWS_REGION: The AWS region of the bucket. See docs [here](https://docs.aws.amazon.com/general/latest/gr/rande.html).
- AWS_ACCESS_KEY_ID: The AWS access key
- AWS_SECRET_ACCESS_KEY: The AWS secret access key
- CLOUDFRONT_DISTRIBUTION: The CloudFront distribution id

If you need help setting up S3, Route53 or CloudFront, read [this tutorial](https://karelledru.com/2016/06/static-site-hosting-on-S3-and-CloudFront).

You also want to make sure that the AWS keys have access to the S3 bucket and Cloudfront. Once that's the case, you can deploy by running `gulp build:deploy`.

---

## Credits

This project is inspired by the work of [Sean Farrell](http://www.rioki.org/2014/06/09/jekyll-to-gulp.html) and [Zell Liew](http://zellwk.com/blog/nunjucks-with-gulp/) and a bunch of other folks.

---

## Todo

- Sitemap.xml
- Social sharing
- Tags
- Months pages
