import Head from "next/head";
import Swal from "sweetalert2";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { LogIn } from "lucide-react";
import * as Api from "@/services/api";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { loadUser, loginUser } from "@/store/reducers/auth";
import { Button, Card, Col, Container, Form, Row } from "react-bootstrap";

const Toast = Swal.mixin({
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: toast => {
        toast.onmouseenter = Swal.stopTimer;
        toast.onmouseleave = Swal.resumeTimer;
    },
});

const formatSessionDate = value => {
    if (!value) return "-";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const buildSessionLimitHtml = data => {
    const sessions = (data.active_sessions || [])
        .map((session, index) => {
            const marker = session.will_be_removed ? " <strong>(akan logout)</strong>" : "";
            return `<li>${index + 1}. ${session.platform} — ${formatSessionDate(session.login_at)}${marker}</li>`;
        })
        .join("");

    const displaced = data.displaced_session?.platform || "sesi paling lama";

    return `
        <p>Perangkat ini: <strong>${data.current_device || "Perangkat Lain"}</strong></p>
        <p>Sesi aktif Anda (${(data.active_sessions || []).length}/3):</p>
        <ul style="text-align:left;margin:0 auto;display:inline-block;">${sessions}</ul>
        <p style="margin-top:12px;">Jika lanjut, <strong>${displaced}</strong> akan logout otomatis.</p>
    `;
};

const Login = () => {
    const router = useRouter();
    const dispatch = useDispatch();
    const loginInFlightRef = useRef(false);

    useEffect(() => {
        (async () => {
            const response = await Api.getProfile();

            if (response) {
                dispatch(loadUser(response));
                router.push("/dashboard");
            }
        })();
    }, []);

    const completeLogin = response => {
        if (response?.session_notice?.message) {
            Toast.fire({ icon: "info", title: response.session_notice.message });
        }

        Toast.fire({ icon: "success", title: "Signed in successfully" });
        dispatch(loginUser(response.token));
        router.push("/dashboard");
    };

    const handleLogin = async (identity, password, confirmDisplace = false, rememberMe = false) => {
        if (loginInFlightRef.current) return;

        loginInFlightRef.current = true;

        try {
            const response = await Api.authLogin(identity, password, confirmDisplace, rememberMe);
            completeLogin(response);
        } catch (error) {
            const responseData = error.response?.data;
            const message = responseData?.message || error.message;

            if (error.response?.status === 409 && message === "SESSION_LIMIT_REACHED") {
                loginInFlightRef.current = false;

                const alert = await Swal.fire({
                    icon: "warning",
                    title: "Terdeteksi login di perangkat ke-4",
                    html: buildSessionLimitHtml(responseData),
                    showCancelButton: true,
                    confirmButtonText: "Lanjutkan Login",
                    cancelButtonText: "Batal",
                });

                if (alert.isConfirmed) {
                    await handleLogin(identity, password, true, rememberMe);
                }

                return;
            }

            Toast.fire({ icon: "error", title: message ?? "Login failed" });
        } finally {
            loginInFlightRef.current = false;
        }
    };

    return (
        <>
            <Head>
                <title>Login | ISL</title>
            </Head>

            <section className="vh-100 d-flex align-items-center">
                <Container style={{ paddingBottom: 0 }}>
                    <Row className="justify-content-center">
                        <Col xxl={4} xl={5}>
                            <div className="text-center mb-3">
                                <Image src="/verifikasi-lab-isl/isl_logo.png" width={165} height={50} alt="ISL Logo" priority style={{ objectFit: "cover" }} />
                            </div>
                            <Card className="shadow-lg">
                                <Card.Body>
                                    <h5 className="mb-4 text-center">Masuk untuk melanjutkan</h5>
                                    <Form
                                        onSubmit={e => {
                                            e.preventDefault();

                                            handleLogin(
                                                e.target.username.value,
                                                e.target.password.value,
                                                false,
                                                Boolean(e.target.remember?.checked)
                                            );
                                        }}
                                    >
                                        <Form.Group className="mb-3">
                                            <Form.Label htmlFor="username">Username</Form.Label>
                                            <Form.Control type="text" name="username" id="username" required autoFocus />
                                        </Form.Group>
                                        <Form.Group className="mb-3">
                                            <div className="w-100">
                                                <Form.Label htmlFor="password">Password</Form.Label>
                                                <a className="float-end" style={{ pointerEvents: "none" }}>
                                                    Forgot Password?
                                                </a>
                                            </div>
                                            <Form.Control type="password" name="password" id="password" required />
                                        </Form.Group>
                                        <Form.Group className="d-flex align-items-center">
                                            <Form.Check inline type="checkbox" name="remember" label="Remember Me" id="inline-checkbox-1" />
                                            <Button variant="primary" type="submit" className="ms-auto">
                                                Masuk <LogIn size={16} />
                                            </Button>
                                        </Form.Group>
                                    </Form>
                                </Card.Body>
                                <Card.Footer className="py-3 border-0 text-center">
                                    {`Don't have an account? `}
                                    <a className="ml-2" style={{ pointerEvents: "none" }}>
                                        Create one!
                                    </a>
                                </Card.Footer>
                            </Card>
                            <div className="text-center mt-5 text-muted">Copyright &copy; 2025 — Inti Surya Laboratorium, PT</div>
                        </Col>
                    </Row>
                </Container>
            </section>
        </>
    );
};

export default Login;
