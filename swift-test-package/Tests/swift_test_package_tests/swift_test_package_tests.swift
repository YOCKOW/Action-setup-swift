@testable import swift_test_package
import Testing

@Suite struct Tests {
    @Test func testExample() {
        #expect(S().text == "Hello, World!")
    }
}
