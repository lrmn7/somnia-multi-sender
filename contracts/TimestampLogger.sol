// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TimestampLogger
 * @dev Kontrak ini menerima dan menyimpan pesan timestamp di log (events)
 * dengan biaya kecil. Dana yang terkumpul dapat ditarik oleh pemilik kontrak.
 */
contract TimestampLogger {
    // Alamat pemilik kontrak, ditetapkan saat deploy
    address public owner;

    // Biaya yang diperlukan untuk setiap logging
    uint256 public constant LOG_FEE = 0.001 ether; // 0.001 STT (menggunakan 'ether' karena STT memiliki 18 desimal)

    // Event yang akan dipancarkan setiap kali timestamp berhasil dicatat
    // 'indexed' memungkinkan kita untuk memfilter event berdasarkan pengirim
    event TimestampLogged(address indexed from, string message, uint256 blockTimestamp);

    /**
     * @dev Modifier untuk membatasi akses fungsi hanya untuk pemilik kontrak.
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "Hanya pemilik yang dapat memanggil fungsi ini");
        _;
    }

    /**
     * @dev Constructor untuk menetapkan pemilik kontrak saat pertama kali di-deploy.
     * Alamat yang men-deploy kontrak ini akan menjadi pemiliknya.
     */
    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Fungsi utama untuk mencatat timestamp.
     * Pengguna harus mengirimkan biaya sebesar LOG_FEE.
     * @param _message Pesan string yang akan dicatat (timestamp dari frontend).
     */
    function logTimestamp(string memory _message) public payable {
        // Memastikan pengguna membayar jumlah yang tepat
        require(msg.value == LOG_FEE, "Biaya yang dikirim tidak sesuai (harus 0.001 STT)");

        // Memancarkan event dengan detail transaksi
        emit TimestampLogged(msg.sender, _message, block.timestamp);
    }

    /**
     * @dev Fungsi untuk pemilik kontrak menarik semua saldo STT dari kontrak ini.
     */
    function withdraw() public onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "Saldo kontrak kosong");

        // Kirim semua saldo ke pemilik kontrak
        // Menggunakan .call() adalah cara yang aman untuk mengirim Ether/token native
        (bool success, ) = owner.call{value: balance}("");
        require(success, "Penarikan dana gagal");
    }

    /**
     * @dev Fungsi fallback untuk menerima STT jika ada yang mengirim langsung
     * ke alamat kontrak tanpa memanggil fungsi.
     */
    receive() external payable {}
}