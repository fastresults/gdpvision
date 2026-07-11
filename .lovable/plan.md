## Answer

After publishing, the attached kiosk UI should be found at:

```text
https://present.gdpvision.com/
```

The admin for that same UI should be at:

```text
https://present.gdpvision.com/admin
```

The apex domains should not show this kiosk UI:

```text
https://gdpvision.com/      -> marketing/new public website
https://www.gdpvision.com/  -> marketing/new public website
```

## Publish/update plan

1. Run the required security check before publishing.
2. If there are no blocking critical findings, publish/update the current build.
3. After deployment finishes, verify:

```text
https://present.gdpvision.com/       -> kiosk UI like your screenshot
https://present.gdpvision.com/admin  -> admin
https://gdpvision.com/               -> marketing shell
```

## Important

If `present.gdpvision.com` still shows the marketing page after the publish/update finishes, that means the live deployment has not updated yet or the domain mapping is still serving an older build. The code is now set so `present.gdpvision.com` is forced to the kiosk UI.