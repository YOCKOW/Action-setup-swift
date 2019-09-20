# Action: setup-swift

This action sets up a Swift environment using [swiftenv](https://github.com/kylef/swiftenv).


# Usage

See [action.yml](action.yml)

```yaml
steps:
- uses: actions/checkout@master
- uses: YOCKOW/Action-setup-swift@master
  with:
    swift-version: '5.0.3' # This value is passed to swiftenv without modification. 
- run: swift --version
```


# License
MIT License.  
See "LICENSE.txt" for more information.

