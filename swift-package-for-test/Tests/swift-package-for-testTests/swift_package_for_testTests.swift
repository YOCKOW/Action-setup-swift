import XCTest
@testable import swift_package_for_test

final class swift_package_for_testTests: XCTestCase {
    func testExample() {
        // This is an example of a functional test case.
        // Use XCTAssert and related functions to verify your tests produce the correct
        // results.
        XCTAssertEqual(swift_package_for_test().text, "Hello, World!")
    }

    static var allTests = [
        ("testExample", testExample),
    ]
}
