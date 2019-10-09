# Action: setup-swift

This action sets up a Swift environment using [swiftenv](https://github.com/kylef/swiftenv).


# Usage

See [action.yml](action.yml)

```yaml
steps:
- uses: actions/checkout@master
- uses: YOCKOW/Action-setup-swift@master
  with:
    swift-version: '5.1' # This value is passed to swiftenv without modification. 
- run: swift --version
```

You can see another slightly complex sample in [main.yml](./.github/workflows/main.yml).


# License
MIT License.  
See "LICENSE.txt" for more information.

