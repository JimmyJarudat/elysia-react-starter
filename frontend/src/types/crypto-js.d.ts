declare module "crypto-js" {
  const CryptoJS: {
    AES: {
      encrypt: (message: string, secret: string) => { toString: () => string };
    };
  };

  export default CryptoJS;
}
