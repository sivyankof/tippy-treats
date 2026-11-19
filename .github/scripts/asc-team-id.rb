# Prints the Apple team id of a bundle id, asked from the App Store Connect API with an API key.
# Usage: ruby asc-team-id.rb <AuthKey.p8> <key id> <issuer id> <bundle id>
# Only the Ruby standard library: the macOS runner has it, nothing to install.
require 'base64'
require 'json'
require 'net/http'
require 'openssl'
require 'uri'

key_path, key_id, issuer_id, bundle_id = ARGV
abort('usage: asc-team-id.rb <p8> <key id> <issuer id> <bundle id>') unless bundle_id

def b64url(data)
  Base64.urlsafe_encode64(data, padding: false)
end

key = OpenSSL::PKey.read(File.read(key_path))
now = Time.now.to_i
header = b64url({ alg: 'ES256', kid: key_id, typ: 'JWT' }.to_json)
claims = b64url({ iss: issuer_id, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' }.to_json)
signing_input = "#{header}.#{claims}"
# A JWT carries the two numbers of the ECDSA signature side by side, 32 bytes each, not DER.
der = key.sign(OpenSSL::Digest.new('SHA256'), signing_input)
raw = OpenSSL::ASN1.decode(der).value.map { |part| part.value.to_s(2).rjust(32, "\x00") }.join
token = "#{signing_input}.#{b64url(raw)}"

uri = URI('https://api.appstoreconnect.apple.com/v1/bundleIds')
uri.query = URI.encode_www_form('filter[identifier]' => bundle_id, 'fields[bundleIds]' => 'identifier,seedId')
request = Net::HTTP::Get.new(uri)
request['Authorization'] = "Bearer #{token}"
response = Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |http| http.request(request) }
abort("App Store Connect API answered #{response.code}: check the key, its role and the issuer id") unless response.is_a?(Net::HTTPSuccess)

match = JSON.parse(response.body).fetch('data', []).find { |item| item.dig('attributes', 'identifier') == bundle_id }
abort("Bundle id #{bundle_id} is not registered in the developer account (Certificates, Identifiers & Profiles)") unless match
puts match.dig('attributes', 'seedId')
