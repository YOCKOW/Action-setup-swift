import XCTest
@testable import swift_test_package

final class Tests: XCTestCase {
    func testExample() {
        XCTAssertEqual(S().text, "Hello, World!")
    }

    static var allTests = [
        ("testExample", testExample),
    ]
}
