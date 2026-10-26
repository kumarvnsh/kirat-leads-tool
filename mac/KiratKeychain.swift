import Foundation
import Security

// The production identity cannot be selected by caller input.
let productionService = "com.kiratcreations.leaddesk.mail"
let productionAccount = "sales@kiratcreations.com"

func respond(_ result: [String: Any], success: Bool = true) -> Never {
    let data = (try? JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])) ?? Data("{\"ok\":false}".utf8)
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data("\n".utf8))
    exit(success ? 0 : 1)
}

func query(_ service: String, _ account: String) -> [String: Any] {
    return [kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account]
}

func read(_ service: String, _ account: String) throws -> String {
    var q = query(service, account)
    q[kSecReturnData as String] = true
    q[kSecMatchLimit as String] = kSecMatchLimitOne
    var result: CFTypeRef?
    let status = SecItemCopyMatching(q as CFDictionary, &result)
    if status == errSecItemNotFound { return "" }
    guard status == errSecSuccess,
          let data = result as? Data,
          let password = String(data: data, encoding: .utf8) else { throw Failure.keychain }
    return password
}

enum Failure: Error { case keychain, input }

func write(_ service: String, _ account: String, _ password: String) throws {
    let q = query(service, account)
    let data = Data(password.utf8)
    let status = SecItemUpdate(q as CFDictionary, [kSecValueData as String: data] as CFDictionary)
    if status == errSecItemNotFound {
        var add = q
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        guard SecItemAdd(add as CFDictionary, nil) == errSecSuccess else { throw Failure.keychain }
    } else if status != errSecSuccess { throw Failure.keychain }
}

func remove(_ service: String, _ account: String) throws {
    let status = SecItemDelete(query(service, account) as CFDictionary)
    guard status == errSecSuccess || status == errSecItemNotFound else { throw Failure.keychain }
}

// Only this static CLI argument is supported; no credentials enter argv.
if CommandLine.arguments == [CommandLine.arguments[0], "--self-test"] {
    let service = "com.kiratcreations.leaddesk.mail.self-test"
    let account = "isolated-test"
    do {
        defer { try? remove(service, account) }
        try remove(service, account)
        guard try read(service, account).isEmpty else { throw Failure.keychain }
        try write(service, account, "kirat-nonsecret-self-test")
        guard try read(service, account) == "kirat-nonsecret-self-test" else { throw Failure.keychain }
        try write(service, account, "kirat-nonsecret-updated")
        guard try read(service, account) == "kirat-nonsecret-updated" else { throw Failure.keychain }
        try remove(service, account)
        guard try read(service, account).isEmpty else { throw Failure.keychain }
        respond(["ok": true])
    } catch { respond(["ok": false, "error": "Isolated Keychain self-test failed"], success: false) }
}

guard CommandLine.arguments.count == 1 else {
    respond(["ok": false, "error": "Invalid helper arguments"], success: false)
}

do {
    // Read at most 8193 bytes so oversized input is rejected without unbounded allocation.
    var input = Data()
    while input.count <= 8192 {
        let chunk = try FileHandle.standardInput.read(upToCount: min(1024, 8193 - input.count)) ?? Data()
        if chunk.isEmpty { break }
        input.append(chunk)
    }
    guard input.count <= 8192,
          let object = try JSONSerialization.jsonObject(with: input) as? [String: Any],
          let action = object["action"] as? String else { throw Failure.input }
    switch action {
    case "get": respond(["ok": true, "password": try read(productionService, productionAccount)])
    case "set":
        guard let password = object["password"] as? String, password.utf8.count <= 1000 else { throw Failure.input }
        try write(productionService, productionAccount, password)
        respond(["ok": true])
    case "delete":
        try remove(productionService, productionAccount)
        respond(["ok": true])
    default: throw Failure.input
    }
} catch Failure.input {
    respond(["ok": false, "error": "Invalid helper input"], success: false)
} catch {
    respond(["ok": false, "error": "Keychain operation failed"], success: false)
}
