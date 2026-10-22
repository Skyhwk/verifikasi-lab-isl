import { useEffect, useRef, useState } from "react";
import { Modal, Button, Form, Card, Table } from "react-bootstrap";
import QrScanner from "qr-scanner";
import Swal from "sweetalert2";
import { Check, QrCode, SwitchCamera, X } from "lucide-react";
import * as Api from "@/services/api";
import makeSlice from "@/modules/crypto/makeSlice";
import { useHandleError } from "@/services/useHandleError";

const Toast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.onmouseenter = Swal.stopTimer;
    toast.onmouseleave = Swal.resumeTimer;
  },
});

const QRScannerModal = ({ show, onHide, fetchSamples }) => {
  const scannerRef = useRef(null);
  const videoRef = useRef(null);

  const [cameras, setCameras] = useState([]);
  const [currentCamera, setCurrentCamera] = useState("environment");
  const [scannedValue, setScannedValue] = useState("");
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [dataBottles, setDataBottles] = useState([]);
  const [noSampel, setNoSampel] = useState("");
  const [scanType, setScanType] = useState(null);
  const [penamaanTitik, setPenamaanTitik] = useState("");
  const [totalParameter, setTotalParameter] = useState(null);
  const [activeBottle, setActiveBottle] = useState(null);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const { handleError } = useHandleError();
  const controller = "VerifikasiLabISLController";

  // Initialize and cleanup scanner
  useEffect(() => {
    if (!show) {
      stopScanner();
      return;
    }

    return () => {
      stopScanner();
    };
  }, [show]);

  const initializeScanner = async () => {
    try {
      if (!videoRef.current) return;

      stopScanner();

      const availableCameras = await QrScanner.listCameras();
      setCameras(availableCameras);

      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          setScannedValue(result.data);
          setIsScannerActive(false);
          stopScanner();
          // Langsung panggil checkBottleData setelah scan
          checkBottleData(result.data);
        },
        {
          returnDetailedScanResult: true,
          preferredCamera: currentCamera,
          highlightScanRegion: true,
          highlightCodeOutline: true,
        }
      );

      await scanner.start();
      scannerRef.current = scanner;
    } catch (error) {
      Toast.fire({
        icon: "error",
        title: "Please grant camera permission first",
      });
      console.error("Scanner initialization error:", error);
      setIsScannerActive(false);
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.destroy();
      scannerRef.current = null;
    }
  };

  useEffect(() => {
    if (isScannerActive) {
      initializeScanner();
    } else {
      stopScanner();
    }
  }, [isScannerActive, currentCamera]);

  const toggleCamera = async () => {
    if (cameras.length > 1) {
      setCurrentCamera((prev) =>
        prev === "environment" ? "user" : "environment"
      );
    } else {
      Toast.fire({
        icon: "error",
        title: "Only one camera available",
      });
    }
  };

  const handleClose = () => {
    setIsScannerActive(false);
    setScannedValue("");
    setDataBottles([]);
    setNoSampel("");
    setScanType(null);
    setPenamaanTitik("");
    setTotalParameter(null);
    setActiveBottle(null);
    onHide();
  };

  // const handleSubmit = () => {
  //     if (scannedValue.trim()) {
  //         onScanResult({
  //             noSampel,
  //             dataBottles,
  //             activeBottle
  //         });
  //         handleClose();
  //     } else {
  //         Toast.fire({
  //             icon: "error",
  //             title: "Please scan a QR code or enter a value manually",
  //         });
  //     }
  // };

  const handleScanQR = () => {
    setIsScannerActive(true);
  };

  const handleCloseScanner = () => {
    setIsScannerActive(false);
  };

  const handleInputChange = (e, koding) => {
    const value = e.target.value;
    setDataBottles((prevBottles) =>
      prevBottles.map((bottle) =>
        bottle.koding === koding
          ? { ...bottle, jumlah: parseInt(value) || 0 }
          : bottle
      )
    );
  };

  const isReady = (bottle) => {
    return (
      bottle.disiapkan &&
      bottle.jumlah &&
      bottle.disiapkan.toString() === bottle.jumlah.toString()
    );
  };

  const checkBottleData = async (value) => {
    Swal.fire({
      title: "Loading...",
      text: "Harap tunggu sedang mengecek daftar botol",
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      const response = await Api.fetchGet(
        { no_sampel: value },
        makeSlice(controller, "checkBottle2")
      );

      if (response.status === "200") {
        const resolvedNoSampel = response.no_sampel || value;
        const isSampleNumber = String(value).includes("/");
        setScanType(isSampleNumber ? "sampel" : "botol");
        setNoSampel(resolvedNoSampel);
        if (isSampleNumber) {
          setScannedValue(resolvedNoSampel);
        }
        setPenamaanTitik(response.penamaan_titik || "");
        setTotalParameter(
          response.total_parameter !== undefined ? response.total_parameter : null
        );
        const bottlesWithDisiapkan = response.data_botol || [];

        setDataBottles((prevBottles) => {
          let initialData = [];
          if (
            prevBottles &&
            prevBottles.length > 0 &&
            noSampel === response.no_sampel
          ) {
            initialData = prevBottles;
          } else {
            initialData = response.data_scan || [];
          }

          const baseArray = Array.isArray(initialData) ? initialData : [];
          const combined = [...baseArray];

          (response.data_botol || []).forEach((newItem) => {
            const key = newItem.koding;
            const existingIndex = combined.findIndex(
              (item) => item.koding === key
            );

            if (existingIndex !== -1) {
              const existing = combined[existingIndex];
              combined[existingIndex] = {
                ...existing,
                ...newItem,
                jumlah:
                  existing.jumlah >= existing.disiapkan
                    ? existing.disiapkan
                    : (parseInt(existing.jumlah) || 0) +
                      (parseInt(newItem.add) || 0),
              };
            } else {
              combined.push({
                ...newItem,
                jumlah: parseInt(newItem.add) || 0,
              });
            }
          });

          // Deduplikasi berdasarkan koding
          const uniqueCombined = [];
          const seenKeys = new Set();
          combined.forEach((item) => {
            if (item.koding && !seenKeys.has(item.koding)) {
              seenKeys.add(item.koding);
              uniqueCombined.push(item);
            }
          });

          return uniqueCombined;
        });

        const scannedMatch = bottlesWithDisiapkan.find((b) => b.koding === value);
        setActiveBottle(scannedMatch?.koding || bottlesWithDisiapkan[0]?.koding || null);
        Toast.fire({ icon: "success", title: response.message });
      } else {
        setNoSampel("");
        setScanType(null);
        setPenamaanTitik("");
        setTotalParameter(null);
        setDataBottles([]);
        Toast.fire({
          icon: "error",
          title: response.message || "Terjadi kesalahan",
        });
      }
    } catch (error) {
      setNoSampel("");
      setScanType(null);
      setPenamaanTitik("");
      setTotalParameter(null);
      setDataBottles([]);
      handleError(error);
    }
  };

  const handleSubmitData = async () => {
    try {
      const response = await Api.fetchPost(
        {
          no_sampel: noSampel,
          data_botol: dataBottles,
          scanned_data: scannedValue,
        },
        makeSlice(controller, "storeBottle")
      );

      if (response?.status === "201") {
        Toast.fire({ icon: "success", title: response?.message });
        handleClose();
        fetchSamples();
      } else {
        Toast.fire({
          icon: "error",
          title: response?.message || "Terjadi kesalahan",
          timer: 3000,
        });
      }
    } catch (error) {
      Toast.fire({
        icon: "error",
        title:
          error?.response?.data?.message ||
          error.message ||
          "Terjadi kesalahan",
        timer: 3000,
      });
    }
  };

  const getBottleLabel = (bottle) => {
    if (typeof bottle.jenis_botol === "object") {
      return bottle.jenis_botol.parameter;
    }
    return bottle.jenis_botol || bottle.type_botol || bottle.parameter || "-";
  };

  return (
    <>
      <style jsx global>{`
        .qr-scanner-region {
          border: 2px solid transparent !important;
          border-radius: 12px !important;
          background: linear-gradient(
            135deg,
            #6dd5ed,
            #2193b0
          ); /* Gradient biru */
          padding: 2px; /* Agar border gradient terlihat */
        }
        .qr-scanner-region > div {
          border: 2px solid transparent !important;
          background: linear-gradient(
            135deg,
            #00ff87,
            #60efff
          ); /* Hijau to Cyan */
          border-radius: 8px !important;
        }

        .bottle-ready {
          background: linear-gradient(
            135deg,
            #d4edda,
            #a8e6cf
          ) !important; /* Hijau lembut */
          border-color: #88d4ab !important;
          color: #155724 !important;
        }

        .bottle-not-ready {
          background: linear-gradient(
            135deg,
            #fdfbfb,
            #ebf1d1
          ) !important; /* Krem lembut */
          border-color: #d6d8c6 !important;
          color: #856404 !important;
        }
      `}</style>

      {/* Main Input Modal */}
      <Modal show={show} onHide={handleClose} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Add Sampel</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3">
            <Form.Group className="mb-3">
              <Form.Label>No Sampel</Form.Label>
              <div className="d-flex">
                <Form.Control
                  type="text"
                  value={scannedValue}
                  onChange={(e) => setScannedValue(e.target.value)}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={(e) => {
                    e.preventDefault();
                    setIsInputFocused(false);
                    const val = e.target.value?.trim();
                    if (!val) return;
                    if (noSampel && val === noSampel) return;
                    checkBottleData(val);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const val = e.target.value?.trim();
                      if (val) checkBottleData(val);
                    }
                  }}
                  placeholder="Enter sample number or scan QR code"
                />
                <Button
                  variant="outline-primary"
                  onClick={handleScanQR}
                  className="d-flex align-items-center ms-2"
                >
                  <QrCode size={16} />
                </Button>
              </div>
              {noSampel ? (
                <div className="table-responsive mt-2 mb-2">
                  <Table size="sm" borderless hover={false} className="mb-0 align-middle table-borderless" style={{ fontSize: "0.8rem" }}>
                    <tbody>
                      <tr>
                        <td className="text-secondary fw-semibold py-1 ps-0 pe-1" style={{ width: "115px", whiteSpace: "nowrap" }}>
                          No Sampel
                        </td>
                        <td className="text-center py-1 px-1 text-muted" style={{ width: "12px" }}>:</td>
                        <td className="py-1 px-1 fw-bold font-monospace text-primary text-break">
                          {noSampel}
                        </td>
                      </tr>
                      <tr>
                        <td className="text-secondary fw-semibold py-1 ps-0 pe-1" style={{ whiteSpace: "nowrap" }}>
                          Penamaan Titik
                        </td>
                        <td className="text-center py-1 px-1 text-muted">:</td>
                        <td className="py-1 px-1 fw-semibold text-dark text-break">
                          {penamaanTitik ? String(penamaanTitik).replace(/&amp;/g, "&") : "-"}
                        </td>
                      </tr>
                      <tr>
                        <td className="text-secondary fw-semibold py-1 ps-0 pe-1" style={{ whiteSpace: "nowrap" }}>
                          Total Parameter
                        </td>
                        <td className="text-center py-1 px-1 text-muted">:</td>
                        <td className="py-1 px-1">
                          <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1" style={{ fontSize: "0.72rem" }}>
                            {totalParameter ?? 0} Parameter
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </Table>
                </div>
              ) : null}
            </Form.Group>
          </div>
          {dataBottles && dataBottles.length > 0 && (
            <>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="titik-label mb-0" style={{ fontSize: "0.72rem" }}>
                  Informasi Botol
                </span>
                <small className="text-muted fw-semibold" style={{ fontSize: "0.75rem" }}>
                  {dataBottles.filter((bottle) => isReady(bottle)).length}/{dataBottles.length} lengkap
                </small>
              </div>
              <div className="row g-1 g-sm-2 mb-3">
                {dataBottles.map((bottle, index) => {
                  const prepared = Number(bottle.disiapkan || 0);
                  const qty = Number(bottle.jumlah || 0);
                  const ready = isReady(bottle);
                  const pct = prepared > 0 ? Math.min(100, Math.round((qty / prepared) * 100)) : 0;
                  const name = getBottleLabel(bottle);
                  const isActive = activeBottle === bottle.koding;
                  const colClass =
                    dataBottles.length === 1
                      ? "col-12"
                      : dataBottles.length === 2
                      ? "col-6"
                      : "col-4";

                  return (
                    <div key={index} className={colClass}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setActiveBottle(bottle.koding)}
                        className={`card h-100 p-2 text-start border ${
                          ready
                            ? "border-success bg-success-subtle bg-opacity-25"
                            : isActive
                            ? "border-primary shadow-sm"
                            : "border-secondary-subtle bg-white"
                        }`}
                        style={{
                          cursor: "pointer",
                          borderRadius: "8px",
                          boxShadow: isActive ? "0 0 0 2px rgba(13, 110, 253, 0.25)" : "none",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {/* Header: Nama Botol & Badge */}
                        <div className="d-flex align-items-center justify-content-between mb-1 gap-1">
                          <span
                            className="fw-bold text-truncate text-dark"
                            style={{ fontSize: "0.78rem" }}
                            title={name}
                          >
                            {name}
                          </span>
                          <span
                            className={`badge flex-shrink-0 ${
                              ready
                                ? "bg-success text-white"
                                : qty > 0
                                ? "bg-warning text-dark"
                                : "bg-secondary text-white"
                            }`}
                            style={{ fontSize: "0.58rem", padding: "2px 4px", lineHeight: "1.2" }}
                          >
                            {ready ? "Lengkap" : qty > 0 ? "Sebagian" : "Belum"}
                          </span>
                        </div>

                        {/* Body: Qty scan vs disiapkan */}
                        <div className="d-flex align-items-baseline justify-content-between my-1">
                          <span className="text-muted" style={{ fontSize: "0.68rem" }}>Discan:</span>
                          <span className="fw-bolder" style={{ fontSize: "0.92rem" }}>
                            {ready ? <Check size={12} className="text-success me-1" /> : null}
                            <span className={ready ? "text-success" : qty > 0 ? "text-primary" : "text-dark"}>
                              {qty}
                            </span>
                            <span className="text-muted fw-normal" style={{ fontSize: "0.74rem" }}>
                              /{prepared}
                            </span>
                          </span>
                        </div>

                        {/* Footer: Progress bar */}
                        <div
                          className="progress mt-1"
                          style={{ height: "3px", backgroundColor: "#e9ecef", borderRadius: "2px" }}
                        >
                          <div
                            className={`progress-bar ${ready ? "bg-success" : "bg-primary"}`}
                            style={{ width: `${pct}%`, transition: "width 0.3s ease" }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {activeBottle && scanType === "sampel" && (
                <div className="mb-3">
                  {dataBottles
                    .filter((bottle) => bottle.koding === activeBottle)
                    .map((bottle, index) => (
                      <Form.Group key={index} className="mb-3">
                        <Form.Label>
                          Jumlah Disiapkan
                          <span className="font-weight-bold">
                            {getBottleLabel(bottle)}
                          </span>
                        </Form.Label>
                        <Form.Control
                          type="number"
                          value={bottle.jumlah || ""}
                          onChange={(e) => handleInputChange(e, bottle.koding)}
                          min="0"
                          max={bottle.disiapkan}
                          required
                        />
                        <Form.Text className="text-muted">
                          Jumlah yang harus disiapkan: {bottle.disiapkan}
                        </Form.Text>
                      </Form.Group>
                    ))}
                </div>
              )}
            </>
          )}

          <div className="d-flex justify-content-end gap-2 mt-4">
            <Button variant="danger" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmitData}
              disabled={!scannedValue.trim()}
            >
              Submit
            </Button>
          </div>
        </Modal.Body>
      </Modal>

      {/* Fullscreen Scanner Modal */}
      {isScannerActive && (
        <div
          className="scanner-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100vh",
            backgroundColor: "black",
            zIndex: 9999,
          }}
        >
          <video
            ref={videoRef}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
          <Button
            variant="outline-secondary"
            className="d-flex align-items-center"
            onClick={handleCloseScanner}
            style={{
              position: "absolute",
              top: "20px",
              right: "20px",
              zIndex: 10000,
            }}
          >
            <X size={25} />
          </Button>
          <Button
            variant="outline-light"
            size="lg"
            className="d-flex align-items-center"
            onClick={toggleCamera}
            style={{
              position: "absolute",
              bottom: "20px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 10000,
            }}
          >
            <SwitchCamera size={25} />
            <span className="ms-2">Switch Camera</span>
          </Button>
        </div>
      )}
    </>
  );
};

export default QRScannerModal;
