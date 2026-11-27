import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHmac, generateKeyPairSync, randomBytes, randomUUID, sign } from "node:crypto";
import { createServer, request } from "node:http";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import { setTimeout as sleep } from "node:timers/promises";

const stage = process.argv[2];
const base = "http://127.0.0.1:"+(process.env.PORT || "3458");
assert(["prior","candidate","return"].includes(stage));
const secret = process.env.PIXELFORGE_SESSION_SECRET;
assert.match(secret, /^[0-9a-f]{64}$/);
const issuer = "http://127.0.0.1:19979/fixture-oidc";
const client = "pixelforge-arm64-rehearsal";
const subjectA = "fixture-revocation-prior";
const subjectB = "fixture-revocation-candidate";
const goodSubject = "fixture-positive-control";
const iat = Number(process.env.PIXELFORGE_FIXTURE_IAT);
assert(Number.isSafeInteger(iat) && iat < Date.now() && iat > Date.now()-10*60*1000);
assert.deepEqual((await fetch(base+"/api/health",{signal:AbortSignal.timeout(3000)})).status,200);
const b64 = obj => Buffer.from(JSON.stringify(obj)).toString("base64url");
function cookie(sub) {
  const body=b64({sub,email:"test@example.invalid",iat,exp:iat+3600000});
  return "pixelforge_session="+body+"."+createHmac("sha256",secret).update(body).digest("base64url");
}
// 30×30 synthetic solid-color PNG, no user image.
const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAIAAAC0Ujn1AAAAJ0lEQVR42mNw6ThDI8QwavSo0aNGjxo9avSo0aNGjxo9avSo0eQjAA6Kmqyw6bECAAAAAElFTkSuQmCC","base64");
async function render(sub, route="vectorize", extra={}) {
  const body=new FormData();
  body.set("file", new Blob([image],{type:"image/png"}),"fixture.png");
  for (const [k,v] of Object.entries(extra)) body.set(k,v);
  const response=await fetch(base+"/api/"+route,{
    method:"POST",headers:{cookie:cookie(sub)},body,signal:AbortSignal.timeout(90000)
  });
  const bytes=await response.arrayBuffer();
  return {status:response.status, bytes:bytes.byteLength, type:response.headers.get("content-type")};
}
async function revoke(sub) {
  const kid=randomUUID();
  const {privateKey,publicKey}=generateKeyPairSync("rsa",{modulusLength:2048});
  const key={...publicKey.export({format:"jwk"}),kid,alg:"RS256",use:"sig"};
  const urls={issuer,authorization_endpoint:issuer+"/authorize",token_endpoint:issuer+"/token",
    userinfo_endpoint:issuer+"/userinfo",jwks_uri:issuer+"/jwks"};
  const server=createServer((req,res)=>{
    if(req.url==="/fixture-oidc/.well-known/openid-configuration")
      res.writeHead(200,{"Content-Type":"application/json"}).end(JSON.stringify(urls));
    else if(req.url==="/fixture-oidc/jwks")
      res.writeHead(200,{"Content-Type":"application/json"}).end(JSON.stringify({keys:[key]}));
    else res.writeHead(404).end();
  });
  server.listen(19979,"127.0.0.1");
  await once(server,"listening");
  try {
    const now=Math.floor(Date.now()/1000);
    const unsigned=b64({kid,alg:"RS256",typ:"logout+jwt"})+"."+b64({
      sub, iss:issuer,aud:client,iat:now,exp:now+300,jti:randomUUID(),
      events:{"http://schemas.openid.net/event/backchannel-logout":{}},
    });
    const token=unsigned+"."+sign("RSA-SHA256",Buffer.from(unsigned),privateKey).toString("base64url");
    const response=await fetch(base+"/api/auth/backchannel-logout",{
      method:"POST",body:new URLSearchParams({logout_token:token}),signal:AbortSignal.timeout(10000),
    });
    assert.equal(response.status,200,"signed logout rejected");
    assert.deepEqual(await response.json(),{ok:true});
  } finally {
    server.close();
    server.closeAllConnections();
    await once(server,"close");
  }
}
async function provenPositive(sub) {
  const result=await render(sub);
  assert.equal(result.status,200);
  assert.match(result.type,/image\/svg\+xml/);
  assert(result.bytes>40);
}

async function proveDrain() {
  const lease=randomBytes(16).toString("hex");
  function control(action) {
    const cmd=spawnSync(globalThis.process.execPath,["scripts/drain-control.mjs",action,lease],
        {encoding:"utf8",timeout:4000});
    assert.equal(cmd.status,0,"private drain CLI failed");
    return JSON.parse(cmd.stdout);
  }
  const boundary="pixel-forge-arm64-loopback-fixture";
  let slow;
  const done=new Promise((resolve,reject)=>{
    slow=request(base+"/api/removebg",{
      method:"POST",headers:{cookie:cookie(goodSubject),"Content-Type":"multipart/form-data; boundary="+boundary},
    },res=>{
      let size=0;
      res.on("data",c=>{size+=c.length;});
      res.on("end",()=>resolve({status:res.statusCode,size,ended:res.complete}));
      res.on("error",reject);
    });
    slow.on("error",reject);
    slow.setTimeout(90000,()=>slow.destroy(new Error("synthetic request timeout")));
    slow.write("--"+boundary+"\r\nContent-Disposition: form-data; name=\"model\"\r\n\r\nu2netp\r\n");
    slow.write("--"+boundary+"\r\nContent-Disposition: form-data; name=\"file\"; filename=\"fixture.png\"\r\nContent-Type: image/png\r\n\r\n");
  });
  done.catch(()=>{});
  // Keep upload open and let the server reach multipart before initiating
  // maintenance. If timing is off fail closed, never claim a drain proof.
  try {
    await sleep(750);
    const entered=control("begin");
    assert.equal(entered.admitidas,1);
    assert.equal(entered.listo,false);
    assert.equal(entered.cerrado,true);
    assert.equal((await render(goodSubject)).status,503);
    slow.end(Buffer.concat([image,Buffer.from("\r\n--"+boundary+"--\r\n")]));
    const reply=await done;
    assert.equal(reply.status,200);
    assert(reply.size>40 && reply.ended,"response not fully received");
    const result=control("status");
    assert.equal(result.instancia,entered.instancia);
    assert.equal(result.cerrado,true);
    assert.equal(result.listo,true);
    assert.deepEqual([result.admitidas,result.activos,result.esperando],[0,0,0]);
    console.log("PIXELFORGE_PAIR_DRAIN_AND_FULL_BODY_OK");
  } finally {
    slow.destroy();
  }
}
if(stage==="prior"){
  await provenPositive(subjectA);
  await revoke(subjectA);
  assert.equal((await render(subjectA)).status,401);
} else if(stage==="candidate"){
  assert.equal((await render(subjectA)).status,401);
  await provenPositive(subjectB);
  await revoke(subjectB);
  assert.equal((await render(subjectB)).status,401);
  await proveDrain();
} else {
  assert.equal((await render(subjectA)).status,401);
  assert.equal((await render(subjectB)).status,401);
  await provenPositive(goodSubject);
}

const saved=JSON.parse(await readFile((process.env.PIXELFORGE_STATE_DIR || "/state")+"/revocaciones.json","utf8"));
assert(saved[subjectA]>=iat);
if(stage!=="prior")assert(saved[subjectB]>=iat);
console.log("PIXELFORGE_PAIR_"+stage.toUpperCase()+"_OK");
