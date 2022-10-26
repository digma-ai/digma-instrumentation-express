# Deployment

To deploy this package:

1. Run the `npm version` command to update the `patch`, `minor`, or `major` version:

    ```sh
    npm version [patch|minor|major]
    ```

    This will also create a commit and a version tag in the format `v1.2.3`.

2. Push the commit and the tags:

    ```sh
    git push
    git push --tags
    ```

3. Create a new release:

    1. Go to the **Releases** page for the repository.
    2. Click **Drift a new release**.
    3. Select the tag from the **Choose a tag** dropdown.
    4. Set the **Release title** identical to the tag.
    5. Click **Publish release**.

Creating a release will trigger a GitHub Actions workflow that will automatically build and publish the package.

You can verify the deployment by checking the status of the workflow on the repository **Actions** page and on the package overview page on [npmjs.com](https://npmjs.com).
