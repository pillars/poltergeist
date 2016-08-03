# Open Graph

If you want your posts to have a specific title, description or image diplayed when you share them on Facebook or other social networks, you can do that by adding some `<meta>` tags in the `<head>`.

```html
<!DOCTYPE html>

<html lang="en">

<head>
    <title>{{title}}</title>
    <meta property="og:image"       content="{{ogImage}}" />
    <meta property="og:description" content="{{excerpt}}" />
    <meta property="og:url"         content="{{fullUrl}}" />
    <meta property="og:title"       content="{{title}}" />
</head>

<body>
</body>

</html>
```

## Custom fields

You can define whatever you want in the frontMatter of your posts. If you don't want an `excerpt` for instance, name it whatever you want.

## Magic fields

The `ogImage` is magic. Let's say you have an image living at `posts/my-post/images/my-image.jpg`. If you want to make it your `og:image`, set the `ogImage` in the front matter to `my-image.jpg`. It will be smart to point to the versioned asset in CloudFront automatically.
