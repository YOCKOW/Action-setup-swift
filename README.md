# Action: setup-swift

This action sets up a Swift environment using [swiftenv](https://github.com/kylef/swiftenv).


# Usage

See [action.yml](action.yml)

## Simple Workflow

```yaml
steps:
- uses: actions/checkout@master
- uses: YOCKOW/Action-setup-swift@master
  with:
    swift-version: '5.1.2' # This value is passed to swiftenv without modification. 
- run: swift test
```


## Specify Swift Version with ".swift-version" file.

```yaml
steps:
- uses: actions/checkout@master
- uses: YOCKOW/Action-setup-swift@master
  with:
    swift-package-directory: "./my-swift-package" # Default is "."
    # The content of ".swift-version" will be used to specify the version
    # when `swift-version` input is lacked.
    # Error occurs if no ".swift-version" file is found.
- run: swift test
```


## Others

You can see another slightly complex sample at [the author's gist](https://gist.github.com/YOCKOW/352b3594bfcb2c06d953647adaf65e78).


# License
MIT License.  
See "LICENSE.txt" for more information.

